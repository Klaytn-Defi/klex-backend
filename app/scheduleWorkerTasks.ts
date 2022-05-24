import cron from 'node-cron';
import { tokenPriceService } from '../modules/token-price/token-price.service';
import { blocksSubgraphService } from '../modules/blocks-subgraph/blocks-subgraph.service';
import { balancerSubgraphService } from '../modules/balancer-subgraph/balancer-subgraph.service';
import { balancerService } from '../modules/balancer/balancer.service';
import { beetsService } from '../modules/beets/beets.service';
import { beetsBarService } from '../modules/beets-bar-subgraph/beets-bar.service';
import { portfolioService } from '../modules/portfolio/portfolio.service';
import moment from 'moment-timezone';
import { sleep } from '../modules/util/promise';
import { tokenService } from '../modules/token/token.service';
import { beetsFarmService } from '../modules/beets/beets-farm.service';
import { balancerSdk } from '../modules/balancer-sdk/src/balancer-sdk';

const ONE_MINUTE_IN_MS = 60000;
const TWO_MINUTES_IN_MS = 120000;
const SEVEN_MINUTES_IN_MS = 420000;
const TWENTY_MINUTES_IN_MS = 1200000;

const asyncCallWithTimeout = async (fn: () => Promise<any>, timeLimit: number) => {
    let timeoutHandle: NodeJS.Timeout;

    const timeoutPromise = new Promise((_resolve, reject) => {
        timeoutHandle = setTimeout(() => reject(new Error('Call timed out!')), timeLimit);
    });

    return Promise.race([fn(), timeoutPromise]).then((result) => {
        clearTimeout(timeoutHandle);
        return result;
    });
};

function scheduleJob(
    cronExpression: string,
    taskName: string,
    timeout: number,
    func: () => Promise<void>,
    runOnStartup: boolean = false,
) {
    if (runOnStartup) {
        func().catch(() => {
            console.log(`error on initial run ${taskName}`);
        });
    }

    let running = false;
    cron.schedule(cronExpression, async () => {
        if (running) {
            console.log(`${taskName} already running, skipping call...`);
            return;
        }

        try {
            running = true;
            console.log(`Start ${taskName}...`);
            console.time(taskName);
            await asyncCallWithTimeout(func, timeout);
            console.log(`${taskName} done`);
        } catch (e) {
            console.log(`Error ${taskName}`, e);
        } finally {
            console.timeEnd(taskName);
            running = false;
        }
    });
}

export function scheduleWorkerTasks() {
    //every 20 seconds
    scheduleJob('*/20 * * * * *', 'cache-token-prices', ONE_MINUTE_IN_MS, async () => {
        await tokenPriceService.cacheTokenPrices();
    });

    //every five minutes
    scheduleJob(
        '*/5 * * * *',
        'cache-historical-token-price',
        SEVEN_MINUTES_IN_MS,
        async () => {
            await tokenPriceService.cacheHistoricalTokenPrices();
        },
        true,
    );

    scheduleJob('*/5 * * * *', 'cache-historical-nested-bpt-prices', SEVEN_MINUTES_IN_MS, async () => {
        await tokenPriceService.cacheHistoricalNestedBptPrices();
    });

    scheduleJob('*/5 * * * *', 'cache-average-block-time', SEVEN_MINUTES_IN_MS, async () => {
        await blocksSubgraphService.cacheAverageBlockTime();
    });

    scheduleJob('*/5 * * * *', 'cache-fbeets-apr', SEVEN_MINUTES_IN_MS, async () => {
        await beetsBarService.cacheFbeetsApr();
    });

    scheduleJob('*/5 * * * *', 'cache-tokens', SEVEN_MINUTES_IN_MS, async () => {
        await tokenService.cacheTokens();
    });

    //every 5 seconds
    scheduleJob('*/5 * * * * *', 'cache-balancer-pools', ONE_MINUTE_IN_MS, async () => {
        await balancerService.cachePools();
    });

    //every 5 seconds
    scheduleJob('*/5 * * * * *', 'cache-beets-farms', ONE_MINUTE_IN_MS, async () => {
        await beetsFarmService.cacheBeetsFarms();
    });

    //once a minute
    scheduleJob('* * * * *', 'sor-reload-graph', TWO_MINUTES_IN_MS, async () => {
        await balancerSdk.sor.reloadGraph();
    });

    //every 10 seconds
    scheduleJob('*/10 * * * * *', 'cache-user-pool-shares', ONE_MINUTE_IN_MS, async () => {
        await balancerService.cacheUserPoolShares();
    });

    //every 30 seconds
    scheduleJob('*/30 * * * * *', 'cache-beets-price', TWO_MINUTES_IN_MS, async () => {
        await tokenPriceService.cacheBeetsPrice();
    });

    scheduleJob('*/10 * * * * *', 'cache-beets-farm-users', ONE_MINUTE_IN_MS, async () => {
        await beetsFarmService.cacheBeetsFarmUsers();
    });

    scheduleJob('*/30 * * * * *', 'cache-past-pools', TWO_MINUTES_IN_MS, async () => {
        await balancerService.cachePastPools();
    });

    scheduleJob('*/30 * * * * *', 'cache-protocol-data', TWO_MINUTES_IN_MS, async () => {
        await beetsService.cacheProtocolData();
    });

    scheduleJob('*/30 * * * * *', 'cache-portfolio-pools-data', TWO_MINUTES_IN_MS, async () => {
        const previousBlock = await blocksSubgraphService.getBlockFrom24HoursAgo();
        await balancerSubgraphService.cachePortfolioPoolsData(parseInt(previousBlock.number));
    });

    scheduleJob('5 0 * * *', 'cache-daily-data', TWENTY_MINUTES_IN_MS, async () => {
        console.log('Starting new cron to cache daily data.');
        const timestamp = moment.tz('GMT').startOf('day').unix();

        //retry loop in case of timeouts from the subgraph
        for (let i = 0; i < 10; i++) {
            try {
                await portfolioService.cacheRawDataForTimestamp(timestamp);
                console.log('Finished cron to cache daily data.');
                break;
            } catch (e) {
                console.log(
                    `Error happened during daily caching <${timestamp}>. Running again for the ${i}th time.`,
                    e,
                );
                await sleep(5000);
            }
        }
    });

    tokenPriceService
        .cacheBeetsPrice()
        .then(() =>
            beetsService
                .cacheProtocolData()
                .catch((error) => console.log('Error caching initial protocol data', error)),
        )
        .catch();
    beetsFarmService
        .cacheBeetsFarmUsers(true)
        .catch((error) => console.log('Error caching initial beets farm users', error));

    console.log('scheduled cron jobs');
}
