import bcrypt from 'bcrypt';
import { AuthProvider, PrismaClient, SubscriptionStatus, UserStatus } from '@prisma/client';
import ResourceIdService from '../../src/services/resource-id.service';
import { UsageService } from '../../src/services/billing/services/usage.service';
import { BillingContextService } from '../../src/services/billing/cache/billing.context.service';
import { connectMongo } from '../../src/db/mongo';
import { SchemaBlueprint } from '../../src/models/schema-blueprint.model';
import { SchemaBlueprintVersion } from '../../src/models/schema-blueprint-version.model';
import { ContentEntry } from '../../src/models/content-entry.model';

export async function seedTravelAgency(prisma: PrismaClient) {
  console.log('[TravelAgencySeeder] Seeding Travel Agency workspace, project, schemas, and content entries...');

  // 1. Resolve roles
  const workspaceOwnerRole = await prisma.role.findUnique({
    where: { key: 'WORKSPACE_OWNER' },
  });

  if (!workspaceOwnerRole) {
    throw new Error('WORKSPACE_OWNER role not found. Please run authorization seeder first.');
  }

  const projectOwnerRole = await prisma.role.findUnique({
    where: { key: 'PROJECT_OWNER' },
  });

  if (!projectOwnerRole) {
    throw new Error('PROJECT_OWNER role not found. Please run authorization seeder first.');
  }

  // 2. Resolve plan version (prefer 'pro', fallback to 'free')
  let planVersion = await prisma.planVersion.findFirst({
    where: {
      plan: { key: 'pro' },
      isLatest: true,
    },
    include: { plan: true },
  });

  if (!planVersion) {
    planVersion = await prisma.planVersion.findFirst({
      where: {
        plan: { key: 'free' },
        isLatest: true,
      },
      include: { plan: true },
    });
  }

  if (!planVersion) {
    throw new Error('No active plan version found. Please run billing seeders first.');
  }

  // 3. User, Workspace, Project transaction
  const passwordHash = await bcrypt.hash('Test@12345678', 10);
  const userEmail = 'sarah.jenkins@wanderlust-travel.com';

  const seeded = await prisma.$transaction(async (tx) => {
    // Upsert User
    const user = await tx.user.upsert({
      where: { email: userEmail },
      update: {
        firstName: 'Sarah',
        lastName: 'Jenkins',
        status: UserStatus.ACTIVE,
        emailVerified: true,
      },
      create: {
        resourceId: await ResourceIdService.generateUniqueUserId(tx),
        email: userEmail,
        firstName: 'Sarah',
        lastName: 'Jenkins',
        status: UserStatus.ACTIVE,
        emailVerified: true,
      },
    });

    // Upsert AuthAccount
    await tx.authAccount.upsert({
      where: {
        provider_providerAccountId: {
          provider: AuthProvider.PASSWORD,
          providerAccountId: userEmail,
        },
      },
      update: {
        userId: user.id,
        email: userEmail,
        emailVerified: true,
        passwordHash,
      },
      create: {
        userId: user.id,
        provider: AuthProvider.PASSWORD,
        providerAccountId: userEmail,
        email: userEmail,
        emailVerified: true,
        passwordHash,
      },
    });

    // Workspace
    let workspace = await tx.workspace.findFirst({
      where: { slug: 'wanderlust-travel' },
    });

    if (!workspace) {
      workspace = await tx.workspace.create({
        data: {
          resourceId: await ResourceIdService.generateUniqueWorkspaceId(tx),
          name: 'Wanderlust Travel Co.',
          slug: 'wanderlust-travel',
          createdById: user.id,
        },
      });
    }

    // Workspace Member
    await tx.workspaceMember.upsert({
      where: {
        workspaceId_userId: {
          workspaceId: workspace.id,
          userId: user.id,
        },
      },
      update: {
        roleId: workspaceOwnerRole.id,
      },
      create: {
        workspaceId: workspace.id,
        userId: user.id,
        roleId: workspaceOwnerRole.id,
      },
    });

    // Subscription
    const startsAt = new Date();
    const subscription = await tx.subscription.upsert({
      where: { workspaceId: workspace.id },
      update: {
        planVersionId: planVersion.id,
        billingOwnerId: user.id,
        status: SubscriptionStatus.ACTIVE,
        startsAt,
        expiresAt: null,
      },
      create: {
        workspaceId: workspace.id,
        billingOwnerId: user.id,
        planVersionId: planVersion.id,
        status: SubscriptionStatus.ACTIVE,
        startsAt,
        expiresAt: null,
      },
    });

    const existingSubHistory = await tx.subscriptionHistory.findFirst({
      where: { subscriptionId: subscription.id },
    });

    if (!existingSubHistory) {
      await tx.subscriptionHistory.create({
        data: {
          workspaceId: workspace.id,
          subscriptionId: subscription.id,
          planVersionId: subscription.planVersionId,
          status: subscription.status,
          startsAt: subscription.startsAt,
          endsAt: subscription.expiresAt,
          reason: 'Initial travel agency subscription',
        },
      });
    }

    await tx.user.update({
      where: { id: user.id },
      data: { defaultWorkspaceId: workspace.id },
    });

    // Workspace Member record for project assignment
    const wsMember = await tx.workspaceMember.findUniqueOrThrow({
      where: {
        workspaceId_userId: {
          workspaceId: workspace.id,
          userId: user.id,
        },
      },
    });

    // Project
    let project = await tx.project.findFirst({
      where: {
        workspaceId: workspace.id,
        slug: 'wanderlust-portal',
      },
    });

    if (!project) {
      project = await tx.project.create({
        data: {
          resourceId: await ResourceIdService.generateUniqueProjectId(tx),
          workspaceId: workspace.id,
          createdById: user.id,
          name: 'Wanderlust Expeditions Portal',
          slug: 'wanderlust-portal',
          description: 'Global luxury tours and adventure travel booking catalog.',
          supportedLanguages: ['en', 'es', 'fr'],
        },
      });
    } else {
      project = await tx.project.update({
        where: { id: project.id },
        data: {
          supportedLanguages: ['en', 'es', 'fr'],
        },
      });
    }

    // Project Member
    await tx.projectMember.upsert({
      where: {
        projectId_workspaceMemberId: {
          projectId: project.id,
          workspaceMemberId: wsMember.id,
        },
      },
      update: {
        roleId: projectOwnerRole.id,
      },
      create: {
        projectId: project.id,
        workspaceMemberId: wsMember.id,
        roleId: projectOwnerRole.id,
      },
    });

    // Environments: strictly 2 environments (development: rank 10, production: rank 20, isEditable: false)
    const existingEnvs = await tx.environment.findMany({
      where: { projectId: project.id },
    });

    const hasDev = existingEnvs.some((e) => e.name === 'development');
    const hasProd = existingEnvs.some((e) => e.name === 'production');

    if (!hasDev) {
      await tx.environment.create({
        data: {
          projectId: project.id,
          name: 'development',
          rank: 10,
          isEditable: true,
        },
      });
    }

    if (!hasProd) {
      await tx.environment.create({
        data: {
          projectId: project.id,
          name: 'production',
          rank: 20,
          isEditable: false,
        },
      });
    }

    return {
      userId: user.id,
      workspaceId: workspace.id,
      projectId: project.id,
      planVersionId: planVersion.id,
    };
  });

  // 4. Billing usage cache
  try {
    await UsageService.initialize(Number(seeded.workspaceId), seeded.planVersionId);
    await BillingContextService.refresh(Number(seeded.workspaceId));
  } catch (err) {
    console.warn('[TravelAgencySeeder] Billing cache warning:', (err as Error).message);
  }

  // 5. Connect MongoDB
  await connectMongo();

  // 6. Define MongoDB Schema Blueprints
  const blueprintDefinitions = [
    {
      name: 'Tour Packages',
      slug: 'tour-packages',
      type: 'collection' as const,
      icon: 'explore',
      description: 'Curated multi-day guided expeditions and luxury adventure tours.',
      schemaDefinition: {
        version: 1,
        fields: [
          {
            id: 'fld-tour-title',
            key: 'title',
            type: 'text',
            label: 'Tour Title',
            required: true,
            isLocalized: true,
            isClientEditable: true,
          },
          {
            id: 'fld-tour-dest',
            key: 'destination',
            type: 'text',
            label: 'Destination / Region',
            required: true,
            isLocalized: false,
            isClientEditable: true,
          },
          {
            id: 'fld-tour-price',
            key: 'price',
            type: 'number',
            label: 'Starting Price (USD)',
            required: true,
            isLocalized: false,
            isClientEditable: true,
          },
          {
            id: 'fld-tour-days',
            key: 'duration_days',
            type: 'number',
            label: 'Duration (Days)',
            required: true,
            isLocalized: false,
            isClientEditable: true,
          },
          {
            id: 'fld-tour-hero',
            key: 'hero_image',
            type: 'image',
            label: 'Cover Photo',
            required: false,
            isLocalized: false,
            isClientEditable: true,
          },
          {
            id: 'fld-tour-highlights',
            key: 'highlights',
            type: 'textarea',
            label: 'Tour Highlights',
            required: false,
            isLocalized: true,
            isClientEditable: true,
          },
          {
            id: 'fld-tour-desc',
            key: 'description',
            type: 'richtext',
            label: 'Detailed Itinerary & Overview',
            required: true,
            isLocalized: true,
            isClientEditable: true,
          },
          {
            id: 'fld-tour-feat',
            key: 'featured',
            type: 'boolean',
            label: 'Featured On Homepage',
            required: false,
            isLocalized: false,
            isClientEditable: true,
            defaultValue: false,
          },
        ],
      },
    },
    {
      name: 'Destinations',
      slug: 'destinations',
      type: 'collection' as const,
      icon: 'public',
      description: 'Featured travel destinations, local highlights, and seasonal travel advice.',
      schemaDefinition: {
        version: 1,
        fields: [
          {
            id: 'fld-dest-title',
            key: 'title',
            type: 'text',
            label: 'Destination Name',
            required: true,
            isLocalized: true,
            isClientEditable: true,
          },
          {
            id: 'fld-dest-country',
            key: 'country',
            type: 'text',
            label: 'Country',
            required: true,
            isLocalized: false,
            isClientEditable: true,
          },
          {
            id: 'fld-dest-besttime',
            key: 'best_time',
            type: 'text',
            label: 'Best Time to Visit',
            required: false,
            isLocalized: true,
            isClientEditable: true,
          },
          {
            id: 'fld-dest-photo',
            key: 'cover_photo',
            type: 'image',
            label: 'Destination Photo',
            required: false,
            isLocalized: false,
            isClientEditable: true,
          },
          {
            id: 'fld-dest-overview',
            key: 'overview',
            type: 'richtext',
            label: 'Destination Overview',
            required: true,
            isLocalized: true,
            isClientEditable: true,
          },
        ],
      },
    },
    {
      name: 'Traveler Reviews',
      slug: 'traveler-reviews',
      type: 'collection' as const,
      icon: 'star',
      description: 'Verified client testimonials and travel stories.',
      schemaDefinition: {
        version: 1,
        fields: [
          {
            id: 'fld-rev-title',
            key: 'title',
            type: 'text',
            label: 'Review Title',
            required: true,
            isLocalized: true,
            isClientEditable: true,
          },
          {
            id: 'fld-rev-client',
            key: 'client_name',
            type: 'text',
            label: 'Traveler Name',
            required: true,
            isLocalized: false,
            isClientEditable: true,
          },
          {
            id: 'fld-rev-tour',
            key: 'tour_name',
            type: 'text',
            label: 'Tour Taken',
            required: true,
            isLocalized: false,
            isClientEditable: true,
          },
          {
            id: 'fld-rev-rating',
            key: 'rating',
            type: 'number',
            label: 'Rating (1-5)',
            required: true,
            isLocalized: false,
            isClientEditable: true,
          },
          {
            id: 'fld-rev-quote',
            key: 'quote',
            type: 'richtext',
            label: 'Testimonial / Review',
            required: true,
            isLocalized: true,
            isClientEditable: true,
          },
        ],
      },
    },
    {
      name: 'Agency Settings',
      slug: 'agency-settings',
      type: 'singleton' as const,
      icon: 'settings',
      description: 'Global site branding, homepage hero copy, and contact credentials.',
      schemaDefinition: {
        version: 1,
        fields: [
          {
            id: 'fld-set-title',
            key: 'title',
            type: 'text',
            label: 'Site Title',
            required: true,
            isLocalized: false,
            isClientEditable: true,
          },
          {
            id: 'fld-set-agency',
            key: 'agency_name',
            type: 'text',
            label: 'Agency Name',
            required: true,
            isLocalized: false,
            isClientEditable: true,
          },
          {
            id: 'fld-set-headline',
            key: 'hero_headline',
            type: 'text',
            label: 'Homepage Hero Headline',
            required: true,
            isLocalized: true,
            isClientEditable: true,
          },
          {
            id: 'fld-set-subheadline',
            key: 'hero_subheadline',
            type: 'textarea',
            label: 'Homepage Hero Subtitle',
            required: true,
            isLocalized: true,
            isClientEditable: true,
          },
          {
            id: 'fld-set-email',
            key: 'contact_email',
            type: 'email',
            label: 'Support & Booking Email',
            required: true,
            isLocalized: false,
            isClientEditable: true,
          },
          {
            id: 'fld-set-phone',
            key: 'phone',
            type: 'text',
            label: 'Customer Service Phone',
            required: true,
            isLocalized: false,
            isClientEditable: true,
          },
          {
            id: 'fld-set-notice',
            key: 'booking_notice',
            type: 'richtext',
            label: 'Booking Policy & Terms Notice',
            required: false,
            isLocalized: true,
            isClientEditable: true,
          },
        ],
      },
    },
  ];

  const savedBlueprints: Record<string, any> = {};

  for (const def of blueprintDefinitions) {
    const blueprint = await SchemaBlueprint.findOneAndUpdate(
      { projectId: seeded.projectId, slug: def.slug },
      {
        $set: {
          projectId: seeded.projectId,
          name: def.name,
          slug: def.slug,
          type: def.type,
          icon: def.icon,
          description: def.description,
          schemaDefinition: def.schemaDefinition,
          activeVersionNumber: 1,
          environmentVersions: { development: 1, production: 1 },
          environments: ['development', 'production'],
          deployedAt: { development: new Date(), production: new Date() },
          createdBy: seeded.userId,
        },
      },
      { upsert: true, new: true }
    );

    savedBlueprints[def.slug] = blueprint;

    // Snapshot version 1 in SchemaBlueprintVersion
    await SchemaBlueprintVersion.findOneAndUpdate(
      { projectId: seeded.projectId, blueprintId: blueprint._id, versionNumber: 1 },
      {
        $set: {
          projectId: seeded.projectId,
          blueprintId: blueprint._id,
          blueprintSlug: blueprint.slug,
          blueprintName: blueprint.name,
          versionNumber: 1,
          semanticVersion: 'v1.0.0',
          schemaDefinition: def.schemaDefinition,
          summary: {
            addedFields: def.schemaDefinition.fields.map((f) => f.key),
            modifiedFields: [],
            removedFields: [],
          },
          changelog: 'Initial production blueprint release',
          createdBy: seeded.userId,
        },
      },
      { upsert: true, new: true }
    );
  }

  // 7. Seed Mock Content Entries with multi-lingual translations
  const mockTourPackages = [
    {
      slug: 'incan-wonders-machu-picchu',
      title: 'Incan Wonders & Machu Picchu Trek',
      content: {
        title: 'Incan Wonders & Machu Picchu Trek',
        destination: 'Cusco & Sacred Valley, Peru',
        price: 2850,
        duration_days: 8,
        hero_image: 'https://images.unsplash.com/photo-1526392060635-9d6019884377?auto=format&fit=crop&w=1200&q=80',
        highlights: 'Private guided tour of Machu Picchu at sunrise, Luxury train ride through the Sacred Valley, Traditional Peruvian culinary masterclass in Cusco',
        description: '<p>Embark on an unforgettable 8-day expedition through the ancient heart of the Inca Empire. From the vibrant stone alleys of Cusco to the mist-shrouded citadel of Machu Picchu, discover Peru\'s most awe-inspiring landscapes and heritage.</p>',
        featured: true,
      },
      translations: {
        es: {
          title: 'Maravillas Incas y Caminata a Machu Picchu',
          highlights: 'Visita guiada privada a Machu Picchu al amanecer, Viaje en tren de lujo por el Valle Sagrado, Clase magistral de cocina tradicional peruana en Cusco',
          description: '<p>Embárquese en una expedición inolvidable de 8 días por el corazón antiguo del Imperio Inca. Desde los vibrantes callejones de piedra de Cusco hasta la ciudadela del Machu Picchu, descubra los paisajes y el patrimonio más inspiradores de Perú.</p>',
        },
        fr: {
          title: 'Merveilles Incas et Trek du Machu Picchu',
          highlights: 'Visite guidée privée du Machu Picchu au lever du soleil, Trajet en train de luxe à travers la Vallée Sacrée, Cours de cuisine péruvienne traditionnelle à Cusco',
          description: '<p>Embarquez pour une expédition inoubliable de 8 jours au cœur de l\'ancien Empire inca. Des ruelles pavées de Cusco à la citadelle embrumée du Machu Picchu, découvrez les paysages et le patrimoine les plus spectaculaires du Pérou.</p>',
        },
      },
    },
    {
      slug: 'serengeti-great-migration',
      title: 'Serengeti & Ngorongoro Great Migration Safari',
      content: {
        title: 'Serengeti & Ngorongoro Great Migration Safari',
        destination: 'Serengeti National Park, Tanzania',
        price: 4600,
        duration_days: 7,
        hero_image: 'https://images.unsplash.com/photo-1516426122078-c23e76319801?auto=format&fit=crop&w=1200&q=80',
        highlights: 'Witness the legendary Great Wildebeest Migration, Sunrise hot air balloon flight over the Serengeti, Stay at luxury eco-tented safari camps',
        description: '<p>Experience Africa\'s greatest wildlife spectacle. Explore the vast plains of the Serengeti and the volcanic bowl of the Ngorongoro Crater alongside master guides.</p>',
        featured: true,
      },
      translations: {
        es: {
          title: 'Safari de la Gran Migración del Serengeti y Ngorongoro',
          highlights: 'Sea testigo de la legendaria Gran Migración de ñus, Vuelo en globo aerostático al amanecer sobre el Serengeti, Alojamiento en campamentos de safari de lujo',
          description: '<p>Viva el mayor espectáculo de vida silvestre de África. Explore las vastas llanuras del Serengeti y el cráter de Ngorongoro junto a guías expertos.</p>',
        },
        fr: {
          title: 'Safari de la Grande Migration au Serengeti et Ngorongoro',
          highlights: 'Assistez à la légendaire Grande Migration des gnous, Vol en montgolfière au lever du soleil au-dessus du Serengeti, Séjour dans des camps de safari éco-responsables',
          description: '<p>Vivez le plus grand spectacle animalier d\'Afrique. Explorez les vastes plaines du Serengeti et le cratère du Ngorongoro aux côtés de guides passionnés.</p>',
        },
      },
    },
    {
      slug: 'kyoto-autumn-zen',
      title: 'Kyoto Autumn Leaves & Zen Sanctuary',
      content: {
        title: 'Kyoto Autumn Leaves & Zen Sanctuary',
        destination: 'Kyoto & Nara, Japan',
        price: 3400,
        duration_days: 9,
        hero_image: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=1200&q=80',
        highlights: 'Private tea ceremony with a Zen master, Night illumination tour of Kodaiji Temple, Exclusive Kaiseki dining experience in Gion',
        description: '<p>Immerse yourself in centuries of Japanese aesthetic and contemplative tradition. Witness ancient maple groves glowing in fiery autumn crimson.</p>',
        featured: true,
      },
      translations: {
        es: {
          title: 'Hojas de Otoño y Santuario Zen en Kioto',
          highlights: 'Ceremonia de té privada con un maestro Zen, Recorrido nocturno iluminado por el templo Kodaiji, Cena exclusiva Kaiseki en Gion',
          description: '<p>Sumérjase en siglos de tradición estética y contemplativa japonesa. Admire los antiguos bosques de arces brillando en rojo otoñal.</p>',
        },
        fr: {
          title: 'Feuilles d\'Automne et Sanctuaire Zen à Kyoto',
          highlights: 'Cérémonie du thé privée avec un maître Zen, Visite nocturne illuminée du temple Kodaiji, Dîner Kaiseki exclusif à Gion',
          description: '<p>Plongez dans des siècles de tradition contemplative et esthétique japonaise. Admirez les érables séculaires flamboyer aux couleurs de l\'automne.</p>',
        },
      },
    },
    {
      slug: 'amalfi-coast-yacht',
      title: 'Amalfi Coast & Capri Private Yacht Cruise',
      content: {
        title: 'Amalfi Coast & Capri Private Yacht Cruise',
        destination: 'Amalfi Coast & Capri, Italy',
        price: 5200,
        duration_days: 6,
        hero_image: 'https://images.unsplash.com/photo-1533105079780-92b9be482077?auto=format&fit=crop&w=1200&q=80',
        highlights: 'Private catamaran charter around Capri and the Blue Grotto, Cliffside dining in Positano, Lemon grove tour and limoncello tasting in Ravello',
        description: '<p>Discover the sheer glamour of southern Italy from the open waters. Sail along breathtaking vertical cliffs, secluded coves, and pastel-hued villages.</p>',
        featured: false,
      },
      translations: {
        es: {
          title: 'Crucero Privado en Yate por la Costa Amalfitana y Capri',
          highlights: 'Alquiler de catamarán privado por Capri y la Gruta Azul, Cena junto al acantilado en Positano, Visita a limoneros y cata de limoncello en Ravello',
          description: '<p>Descubra el glamour del sur de Italia desde aguas abiertas. Navegue junto a impresionantes acantilados verticales y calas secretas.</p>',
        },
        fr: {
          title: 'Croisière Privée en Yacht sur la Côte Amalfitaine et Capri',
          highlights: 'Croisière privée en catamaran autour de Capri et de la Grotte Bleue, Dîner panoramique à Positano, Visite de citronniers et dégustation de limoncello à Ravello',
          description: '<p>Découvrez le glamour du sud de l\'Italie depuis le large. Naviguez le long de falaises spectaculaires, de criques secrètes et de villages pastel.</p>',
        },
      },
    },
  ];

  const mockDestinations = [
    {
      slug: 'peru-andes',
      title: 'The Peruvian Andes & Sacred Valley',
      content: {
        title: 'The Peruvian Andes & Sacred Valley',
        country: 'Peru',
        best_time: 'May to October (dry Andean season)',
        cover_photo: 'https://images.unsplash.com/photo-1526392060635-9d6019884377?auto=format&fit=crop&w=1200&q=80',
        overview: '<p>High in the clouds, the Peruvian Andes cradle ancient civilizations, vibrant indigenous markets, and dramatic mountain scenery.</p>',
      },
      translations: {
        es: {
          title: 'Los Andes Peruanos y el Valle Sagrado',
          best_time: 'Mayo a octubre (temporada seca andina)',
          overview: '<p>En lo alto de las nubes, los Andes peruanos albergan civilizaciones antiguas, mercados indígenas y paisajes de montaña.</p>',
        },
        fr: {
          title: 'Les Andes Péruviennes et la Vallée Sacrée',
          best_time: 'Mai à octobre (saison sèche andine)',
          overview: '<p>Perchés dans les nuages, les Andes péruviennes abritent des civilisations ancestrales, des marchés indigènes et des paysages grandioses.</p>',
        },
      },
    },
    {
      slug: 'tanzania-safari',
      title: 'Tanzania & Serengeti National Park',
      content: {
        title: 'Tanzania & Serengeti National Park',
        country: 'Tanzania',
        best_time: 'June to October (wildlife viewing and river crossings)',
        cover_photo: 'https://images.unsplash.com/photo-1516426122078-c23e76319801?auto=format&fit=crop&w=1200&q=80',
        overview: '<p>Tanzania offers the ultimate quintessential African safari, home to the Big Five and millions of migrating herbivores.</p>',
      },
      translations: {
        es: {
          title: 'Tanzania y el Parque Nacional Serengeti',
          best_time: 'Junio a octubre (observación de fauna y cruces de ríos)',
          overview: '<p>Tanzania ofrece la experiencia definitiva de safari africano, hogar de los Cinco Grandes y millones de herbívoros migratorios.</p>',
        },
        fr: {
          title: 'La Tanzanie et le Parc National du Serengeti',
          best_time: 'Juin à octobre (observation des animaux et traversées de rivières)',
          overview: '<p>La Tanzanie offre l\'expérience de safari africain ultime, abritant les Big Five et des millions d\'herbivores en migration.</p>',
        },
      },
    },
    {
      slug: 'japan-kansai',
      title: 'Kyoto & Kansai Cultural Region',
      content: {
        title: 'Kyoto & Kansai Cultural Region',
        country: 'Japan',
        best_time: 'Late March to April (cherry blossoms) or October to November (autumn foliage)',
        cover_photo: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=1200&q=80',
        overview: '<p>The cultural cradle of Japan, Kyoto boasts over 2,000 temples and shrines, peaceful rock gardens, and traditional artisan workshops.</p>',
      },
      translations: {
        es: {
          title: 'Kioto y la Región Cultural de Kansai',
          best_time: 'Finales de marzo a abril (cerezos en flor) u octubre a noviembre (otoño)',
          overview: '<p>Cuna cultural de Japón, Kioto cuenta con más de 2000 templos y santuarios, serenos jardines zen y talleres artesanales.</p>',
        },
        fr: {
          title: 'Kyoto et la Région Culturelle du Kansai',
          best_time: 'Fin mars à avril (cerisiers en fleurs) ou octobre à novembre (couleurs d\'automne)',
          overview: '<p>Berceau culturel du Japon, Kyoto compte plus de 2 000 temples et sanctuaires, des jardins zen paisibles et des ateliers artisanaux.</p>',
        },
      },
    },
  ];

  const mockReviews = [
    {
      slug: 'elena-rodriguez-machu-picchu',
      title: 'Unbelievable Andean Experience',
      content: {
        title: 'Unbelievable Andean Experience',
        client_name: 'Elena Rodriguez',
        tour_name: 'Incan Wonders & Machu Picchu Trek',
        rating: 5,
        quote: '<p>Wanderlust Travel planned our trip down to the smallest detail. Arriving at the Sun Gate at dawn was a spiritual moment I will never forget.</p>',
      },
      translations: {
        es: {
          title: 'Increíble Experiencia Andina',
          quote: '<p>Wanderlust Travel planificó nuestro viaje hasta el más mínimo detalle. Llegar a la Puerta del Sol al amanecer fue un momento inolvidable.</p>',
        },
        fr: {
          title: 'Une Expérience Andine Extraordinaire',
          quote: '<p>Wanderlust Travel a organisé notre voyage dans les moindres détails. Arriver à la Porte du Soleil à l\'aube a été un moment inoubliable.</p>',
        },
      },
    },
    {
      slug: 'marcus-vance-serengeti',
      title: 'Life-Changing African Safari',
      content: {
        title: 'Life-Changing African Safari',
        client_name: 'Marcus Vance',
        tour_name: 'Serengeti & Ngorongoro Great Migration Safari',
        rating: 5,
        quote: '<p>The guides were top-notch naturalists. We saw three leopard sightings and the Mara river crossing in a single afternoon!</p>',
      },
      translations: {
        es: {
          title: 'Un Safari Africano que te Cambia la Vida',
          quote: '<p>Los guías fueron naturalistas excepcionales. Vimos tres avistamientos de leopardos y el cruce del río Mara en una sola tarde.</p>',
        },
        fr: {
          title: 'Un Safari Africain Révolutionnaire',
          quote: '<p>Les guides étaient des naturalistes exceptionnels. Nous avons aperçu trois léopards et la traversée de la rivière Mara en un seul après-midi !</p>',
        },
      },
    },
    {
      slug: 'claire-dupont-kyoto',
      title: 'Serene & Beautiful Autumn in Kyoto',
      content: {
        title: 'Serene & Beautiful Autumn in Kyoto',
        client_name: 'Claire Dupont',
        tour_name: 'Kyoto Autumn Leaves & Zen Sanctuary',
        rating: 5,
        quote: '<p>Staying in authentic ryokans and taking part in an exclusive tea ceremony was extraordinary. The translations in the client portal made everything effortless.</p>',
      },
      translations: {
        es: {
          title: 'Otoño Sereno y Bello en Kioto',
          quote: '<p>Alojarse en ryokans auténticos y participar en una ceremonia de té exclusiva fue extraordinario. Todo fue impecable.</p>',
        },
        fr: {
          title: 'Sérénité et Beauté Automnale à Kyoto',
          quote: '<p>Séjourner dans des ryokans authentiques et participer à une cérémonie du thé privée était extraordinaire. Tout était fluide et parfait.</p>',
        },
      },
    },
  ];

  const mockAgencySettings = [
    {
      slug: 'default',
      title: 'Wanderlust Travel Co. Site Settings',
      content: {
        title: 'Wanderlust Travel Co. Site Settings',
        agency_name: 'Wanderlust Travel Co.',
        hero_headline: 'Handcrafted Luxury Journeys to the World\'s Wildest Horizons',
        hero_subheadline: 'Bespoke itineraries, expert private guides, and verified sustainable accommodations for the discerning global traveler.',
        contact_email: 'concierge@wanderlust-travel.com',
        phone: '+1 (800) 555-0199',
        booking_notice: '<p>All bookings include 24/7 dedicated travel concierge support and complete carbon offset compensation.</p>',
      },
      translations: {
        es: {
          hero_headline: 'Viajes de Lujo Personalizados a los Horizontes Más Extraordinarios del Mundo',
          hero_subheadline: 'Itinerarios a medida, guías privados expertos y alojamientos sostenibles para el viajero más exigente.',
          booking_notice: '<p>Todas las reservas incluyen asistencia de conserjería de viajes 24/7 y compensación completa de huella de carbono.</p>',
        },
        fr: {
          hero_headline: 'Voyages de Luxe Sur-Mesure vers les Horizons les Plus Extraordinaires du Monde',
          hero_subheadline: 'Itinéraires personnalisés, guides privés experts et hébergements durables d\'exception pour les voyageurs exigeants.',
          booking_notice: '<p>Toutes les réservations incluent une conciergerie de voyage disponible 24h/24 et 7j/7 ainsi qu\'une compensation carbone intégrale.</p>',
        },
      },
    },
  ];

  const entryGroups = [
    { schemaSlug: 'tour-packages', entries: mockTourPackages },
    { schemaSlug: 'destinations', entries: mockDestinations },
    { schemaSlug: 'traveler-reviews', entries: mockReviews },
    { schemaSlug: 'agency-settings', entries: mockAgencySettings },
  ];

  const environmentsToSeed = ['development', 'production'];

  for (const env of environmentsToSeed) {
    for (const group of entryGroups) {
      const blueprint = savedBlueprints[group.schemaSlug];
      if (!blueprint) continue;

      for (const entryDef of group.entries) {
        const translationStatuses = {
          es: { status: 'completed' as const, updatedAt: new Date() },
          fr: { status: 'completed' as const, updatedAt: new Date() },
        };

        const isProd = env === 'production';

        await ContentEntry.findOneAndUpdate(
          {
            projectId: seeded.projectId,
            schemaSlug: group.schemaSlug,
            environment: env,
            slug: entryDef.slug,
          },
          {
            $set: {
              projectId: seeded.projectId,
              schemaId: blueprint._id,
              schemaSlug: group.schemaSlug,
              slug: entryDef.slug,
              title: entryDef.title,
              status: 'published',
              environment: env,
              baseLanguage: 'en',
              content: entryDef.content,
              translations: entryDef.translations,
              translationStatuses,
              publishedAt: new Date(),
              publishedTitle: entryDef.title,
              publishedContent: entryDef.content,
              createdBy: seeded.userId,
              updatedBy: seeded.userId,
            },
          },
          { upsert: true, new: true }
        );
      }
    }
  }

  console.log('[TravelAgencySeeder] Successfully seeded Wanderlust Travel Co.');
  console.log('  User: sarah.jenkins@wanderlust-travel.com (Password: Test@12345678)');
  console.log('  Workspace: Wanderlust Travel Co. (wanderlust-travel)');
  console.log('  Project: Wanderlust Expeditions Portal (wanderlust-portal)');
  console.log('  Environments: development (rank 10), production (rank 20, isEditable: false)');
  console.log('  Blueprints: 4 (tour-packages, destinations, traveler-reviews, agency-settings)');
  console.log('  Content Entries: 11 entries seeded across development and production with EN/ES/FR translations');
}
