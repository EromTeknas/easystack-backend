import { env } from "./env";

export const mongo = {
  uri: env.MONGO_URI,
};

export default mongo;
