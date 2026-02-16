# Billing System Implementation Checklist

Use this checklist to track your billing system integration progress.

## ✅ Phase 1: Database Setup

- [ ] Run Prisma migration: `npm run prisma:migrate dev`
- [ ] Regenerate Prisma client: `npm run prisma:generate`
- [ ] Verify tables created: `plans`, `subscriptions`, `plan_versions`
- [ ] Seed default plans: `npm run billing:seed`
- [ ] Verify 4 plans exist (Free, Pro, Team, Enterprise)
- [ ] Assign free plan to existing users: `npm run billing:assign-free`
- [ ] Verify all users have subscriptions

## ✅ Phase 2: API Testing

- [ ] Test public plans endpoint: `GET /api/billing/plans`
- [ ] Test user plan endpoint: `GET /api/billing/my-plan` (with auth)
- [ ] Test admin plans list: `GET /api/admin/billing/plans` (admin auth)
- [ ] Test creating custom plan (admin only)
- [ ] Test setting custom override (admin only)
- [ ] Verify error responses for unauthorized access

## ✅ Phase 3: Integration (Your Features)

### Projects Route (Example)
- [ ] Add `billingGuard('projects')` to POST /projects
- [ ] Add `trackUsage('projects', 1)` to POST /projects
- [ ] Test creating projects until quota exceeded
- [ ] Verify quota exceeded error response
- [ ] Verify usage increments correctly
- [ ] Test with different plan tiers

### Environments Route (If applicable)
- [ ] Add `billingGuard('environments')` to POST /environments
- [ ] Add `trackUsage('environments', 1)` to POST /environments
- [ ] Test quota enforcement
- [ ] Test usage tracking

### Custom Domain (If applicable)
- [ ] Add `featureGuard('custom_domain')` to custom domain routes
- [ ] Test with Free plan (should fail)
- [ ] Test with Pro plan (should succeed)
- [ ] Verify error message is clear

### AI Features (If applicable)
- [ ] Add `billingGuard('ai_tokens_monthly')` to AI routes
- [ ] Add dynamic `trackUsage('ai_tokens_monthly', (req) => tokens)` 
- [ ] Test AI token counting
- [ ] Verify monthly quota enforcement

### Team Features (If applicable)
- [ ] Add `featureGuard('team_collaboration')` where needed
- [ ] Test with plans that have/don't have the feature
- [ ] Verify proper access control

## ✅ Phase 4: Registration Flow

- [ ] Import `BillingService` in register controller
- [ ] Add `await BillingService.createFreeSubscription(newUser.id)` after user creation
- [ ] Test new user registration
- [ ] Verify new users automatically get Free plan
- [ ] Test that new users can immediately create resources

## ✅ Phase 5: Admin Operations

- [ ] Test creating a custom plan via API
- [ ] Test updating an existing plan (verify versioning)
- [ ] Test giving a user unlimited resources
- [ ] Test changing a user's plan
- [ ] Test viewing plan version history
- [ ] Verify cache invalidation after updates

## ✅ Phase 6: Performance & Monitoring

- [ ] Verify Redis is running and caching works
- [ ] Check Redis keys exist: `redis-cli KEYS billing:*`
- [ ] Verify MongoDB usage collection has data
- [ ] Check that usage tracking is non-blocking
- [ ] Monitor response times with billing guards
- [ ] Test under load (multiple concurrent requests)

## ✅ Phase 7: Error Handling

- [ ] Test quota exceeded error
- [ ] Test feature not available error
- [ ] Test subscription not found error
- [ ] Test plan not found error
- [ ] Test admin-only endpoint with non-admin user
- [ ] Verify all errors include `requestId`
- [ ] Verify error responses match expected format

## ✅ Phase 8: Documentation

- [ ] Read [BILLING.md](documentation/BILLING.md)
- [ ] Read [BILLING_MIGRATION.md](documentation/BILLING_MIGRATION.md)
- [ ] Bookmark [BILLING_QUICK_REF.md](documentation/BILLING_QUICK_REF.md)
- [ ] Review example code in [projects.routes.example.ts](src/routes/projects/projects.routes.example.ts)
- [ ] Update API documentation (OpenAPI/Postman) with billing endpoints
- [ ] Document your feature's quota keys
- [ ] Update team wiki/documentation

## ✅ Phase 9: Frontend Integration

- [ ] Create billing context/store
- [ ] Fetch user's plan on app load
- [ ] Display usage/limits in UI
- [ ] Show upgrade prompts when quota reached
- [ ] Handle `QUOTA_EXCEEDED` errors gracefully
- [ ] Handle `FEATURE_NOT_AVAILABLE` errors gracefully
- [ ] Build plan selection/upgrade UI
- [ ] Test error UX

## ✅ Phase 10: Production Readiness

- [ ] Test all billing flows in staging
- [ ] Verify Redis connection in production
- [ ] Verify MongoDB connection in production
- [ ] Set up monitoring/alerts for quota issues
- [ ] Plan for Stripe integration (future)
- [ ] Plan for usage analytics dashboard (future)
- [ ] Document runbook for common billing issues
- [ ] Train support team on billing system

## 🎯 Optional Enhancements

- [ ] Add usage alerts (notify at 80% quota)
- [ ] Build admin dashboard for plan management
- [ ] Add plan comparison page
- [ ] Implement self-service plan upgrades
- [ ] Add invoice generation
- [ ] Integrate Stripe webhooks
- [ ] Add usage analytics
- [ ] Implement trial periods
- [ ] Add promo codes/coupons

## 📊 Success Criteria

- ✅ All users have active subscriptions
- ✅ Quota enforcement works correctly
- ✅ Feature flags work correctly
- ✅ Usage tracking is accurate
- ✅ Admin can manage plans easily
- ✅ Performance is acceptable (<50ms overhead)
- ✅ Errors are clear and actionable
- ✅ Documentation is complete
- ✅ Team understands the system

## 🐛 Common Issues & Solutions

### Issue: "No active subscription found"
**Solution:** Run `npm run billing:assign-free`

### Issue: "Free plan not found"
**Solution:** Run `npm run billing:seed`

### Issue: Quota not enforcing
**Check:**
- [ ] Middleware is applied to route
- [ ] User is authenticated
- [ ] Feature key matches plan config
- [ ] Usage is being tracked

### Issue: Usage not incrementing
**Check:**
- [ ] `trackUsage` middleware is applied
- [ ] Response is successful (2xx)
- [ ] MongoDB is running
- [ ] No errors in logs

### Issue: Slow response times
**Check:**
- [ ] Redis is running (caching)
- [ ] MongoDB connection is healthy
- [ ] Cache TTL is reasonable
- [ ] Not over-checking quotas

## 📞 Need Help?

- **Setup:** [BILLING_MIGRATION.md](documentation/BILLING_MIGRATION.md)
- **Usage:** [BILLING_QUICK_REF.md](documentation/BILLING_QUICK_REF.md)
- **Details:** [BILLING.md](documentation/BILLING.md)
- **Examples:** [projects.routes.example.ts](src/routes/projects/projects.routes.example.ts)

---

**Progress:** [ ] / 60+ items completed

**Target Date:** _____________

**Notes:**

---

[← Back to BILLING_README](BILLING_README.md)
