import axios from 'axios';
import * as uuid from 'uuid';

// Type Utils

// https://www.piotrl.net/typescript-condition-subset-types/
type FilterFlags<Base, Condition> = {
  [Key in keyof Base]: Base[Key] extends Condition ? Key : never;
};
type AllowedNames<Base, Condition> = FilterFlags<Base, Condition>[keyof Base];

type RevFilterFlags<Base, Condition> = {
  [Key in keyof Base]: Base[Key] extends Condition ? never : Key;
};
type RevAllowedNames<Base, Condition> = RevFilterFlags<Base, Condition>[keyof Base];

// Types

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

/**
 * A set of key value pairs where the key is the event and the value is the additional details. When
 * the additional details are undefined, that mean no additional details should be passed
 */
export interface EventDetailsMap {
  extension_installed: undefined;
  extension_uninstalled: undefined;
  login: undefined;
  login_refresh: undefined;
  logout: undefined;
  forced_logout: undefined;
  player_injected: undefined;
  episode_started: { episodeDuration: number };
  episode_finished: { episodeDuration: number };
  play: { atTime: number };
  pause: { atTime: number };
  skipped_timestamp: { typeId: string; fromTime: number; toTime: number; skippedDuration: number };
  opened_popup: undefined;
  opened_all_settings: undefined;
  used_keyboard_shortcut: { keyCombo: string; operation: string };
  started_creating_timestamp: { atTime: number };
}

export type EventsWithoutDetails = RevAllowedNames<EventDetailsMap, object>;
export type EventsWithDetails = AllowedNames<EventDetailsMap, object>;

export interface UsageStatsClient {
  saveEvent(event: EventsWithoutDetails): Promise<void>;
  saveEvent<TEvent extends EventsWithDetails>(
    event: TEvent,
    additionalDetails: EventDetailsMap[TEvent],
  ): Promise<void>;
}

// Utils

function generateGuestId(): string {
  return `guest-${uuid.v4()}`;
}

// Client

export function createUsageStatsClient(config: UsageStatsClientConfig): UsageStatsClient {
  async function postEvent(event: any): Promise<void> {
    if (config.send) {
      await axios.post('https://usage-stats.anime-skip.com/events', event);
    } else {
      config.log('Reported event:', event);
    }
  }

  return {
    // @ts-expect-error: Overriding is bad
    async saveEvent(event, additionalDetails) {
      try {
        const timestamp = new Date().toISOString();
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
      } catch (err) {
        config.log('Failed to send event:', err);
      }
    },
  };
}
