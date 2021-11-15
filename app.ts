import { loadRestRoutes } from './app/loadRestRoutes';
import { env } from './app/env';
import createExpressApp, { json } from 'express';
import { corsMiddleware } from './app/middleware/corsMiddleware';
import { contextMiddleware } from './app/middleware/contextMiddleware';
import { accountMiddleware } from './app/middleware/accountMiddleware';
import * as http from 'http';
import { ApolloServer } from 'apollo-server-express';
import { ApolloServerPluginDrainHttpServer } from 'apollo-server-core';
import { generatedGraphQlSchema } from './graphql_schema_generated';
import { resolvers } from './app/resolvers';

// const app = createApp();
// loadRoutes(app);
//
// app.listen(env.PORT, () => {
//     console.log(`Listening on port ${env.PORT}`);
// });
async function startServer() {
    const app = createExpressApp();

    app.use(json({ limit: '1mb' }));
    app.use(corsMiddleware);
    app.use(contextMiddleware);
    app.use(accountMiddleware);

    loadRestRoutes(app);

    const httpServer = http.createServer(app);
    const server = new ApolloServer({
        resolvers: resolvers,
        typeDefs: generatedGraphQlSchema,
        plugins: [ApolloServerPluginDrainHttpServer({ httpServer })],
    });
    await server.start();
    server.applyMiddleware({ app });
    await new Promise<void>((resolve) => httpServer.listen({ port: env.PORT }, resolve));
    console.log(`🚀 Server ready at http://localhost:${env.PORT}${server.graphqlPath}`);
}

startServer();
