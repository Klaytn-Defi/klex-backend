import { EnvType, load } from 'ts-dotenv';
import { resolve } from 'path';

type Env = EnvType<typeof schema>;

export const schema = {
    REDIS_URL: String,
    NODE_ENV: String,
    REDIS_PORT: Number,
    PORT: Number,
    BALANCER_SUBGRAPH: String,
    CHAIN_ID: String,
    CHAIN_SLUG: String,
    NATIVE_ASSET_ADDRESS: String,
    WRAPPED_NATIVE_ASSET_ADDRESS: String,
    COINGECKO_NATIVE_ASSET_ID: String,
    COINGECKO_PLATFORM_ID: String,
    COPPER_PROXY_ADDRESS: String,
    RPC_URL: String,
    MASTERCHEF_ADDRESS: String,
    BEETS_ADDRESS: String,
    FBEETS_ADDRESS: String,
    SANITY_PROJECT_ID: String,
    SANITY_DATASET: String,
    SANITY_API_TOKEN: String,
    FBEETS_POOL_ID: String,
    FBEETS_FARM_ID: String,
    BLOCKS_SUBGRAPH: String,
    SUBGRAPH_START_DATE: String,
  };

export const env: Env = load(schema, {
    path: resolve(__dirname, '../.env'),
    overrideProcessEnv: process.env.NODE_ENV !== 'production',
});
