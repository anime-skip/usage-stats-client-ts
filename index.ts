import axios from 'axios';
import * as uuid from 'uuid';

export type StatsSource = 'api' | 'browser';

export interface UsageStatsClientConfig {
  /**
   * When true, the requests are actually made to the production api. When false, they just get
   * logged
   */
  send: boolean;
  /**
   * The name of the app stats will be collected for
   */
  app: string;
  source: StatsSource;
  browser: string | undefined;
  /**
   * The version of the app stats will be collected for
   */
  appVersion: string;
  /**
   * A function that returns the user id of the logged in user if it exists. If they are not logged
   * in, return `undefined`.
   */
  getUserId(): string | undefined | Promise<string | undefined>;
  /**
   * A function that saves the guest user id when no user id is found. It should persist it to the
   * same place `getUserId` get the id from so the user id remains consistent across requests
   */
  persistGuestUserId(userId: string): void | Promise<void>;
  /**
   * Custom log function that takes in args like `console.log`
   */
  log(...args: any[]): void;
}

export interface UsageStatsClient {
  saveEvent(event: string, additionalDetails?: Record<string, unknown>): Promise<void>;
}

function generateGuestId(): string {
  return `guest-${uuid.v4()}`;
}

export function createUsageStatsClient(config: UsageStatsClientConfig): UsageStatsClient {
  async function postEvent(event: any): Promise<void> {
    if (config.send) {
      await axios.post('https://usage-stats.anime-skip.com/events', event);
    } else {
      config.log('Reported event:', event);
    }
  }

  return {
    saveEvent(event, additionalDetails) {
      const timestamp = new Date().toISOString();
      return Promise.resolve().then(async () => {
        let userId = await config.getUserId();
        if (!userId) {
          userId = generateGuestId();
          await config.persistGuestUserId(userId);
        }
        await postEvent({
          event,
          timestamp,
          userId,
          app: config.app,
          appVersion: config.appVersion,
          source: config.source,
          browser: config.browser,
          additionalDetails,
        });
      });
    },
  };
}
