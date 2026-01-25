import 'dotenv/config';
import { z } from 'zod';

const MongoEnv = z.object({
  MONGO_URI: z.string(),
});

const parsed = MongoEnv.parse(process.env);

export const mongo = {
  uri: parsed.MONGO_URI,
};

export default mongo;
