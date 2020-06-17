/*global SLOBS_BUNDLE_ID*/

import { Inject } from './core/injector';
import { UserService } from './user';
import { HostsService } from './hosts';
import fs from 'fs';
import path from 'path';
import electron from 'electron';
import { authorizedHeaders, handleResponse } from 'util/requests';
import throttle from 'lodash/throttle';
import { Service } from './core/service';
import Utils from './utils';

export type TUsageEvent = 'stream_start' | 'stream_end' | 'app_start' | 'app_close' | 'crash';

interface IUsageApiData {
  installer_id?: string;
  version: string;
  slobs_user_id: string;
  event: TUsageEvent;
  data: string;
}

type TAnalyticsEvent =
  | 'FacebookLogin'
  | 'PlatformLogin'
  | 'SocialShare'
  | 'Recording'
  | 'ReplayBuffer'
  | 'Heartbeat'
  | 'StreamPerformance'
  | 'StreamingStatus';

interface IAnalyticsEvent {
  product: string;
  version: string;
  event: string;
  value?: any;
  time?: string;
  count?: number;
  uuid?: string;
  saveUser?: boolean;
}

export function track(event: TUsageEvent) {
  return (target: any, methodName: string, descriptor: PropertyDescriptor) => {
    return {
      ...descriptor,
      value(...args: any[]): any {
        UsageStatisticsService.instance.recordEvent(event);
        descriptor.value.apply(this, args);
      },
    };
  };
}

export class UsageStatisticsService extends Service {
  @Inject() userService: UserService;
  @Inject() hostsService: HostsService;

  installerId: string;
  version = Utils.env.SLOBS_VERSION;

  private anaiticsEvents: IAnalyticsEvent[] = [];

  init() {
    this.loadInstallerId();
    this.sendAnalytics = throttle(this.sendAnalytics, 30 * 1000);

    setInterval(() => {
      this.recordAnalyticsEvent('Heartbeat', { bundle: SLOBS_BUNDLE_ID });
    }, 10 * 60 * 1000);
  }

  loadInstallerId() {
    let installerId = localStorage.getItem('installerId');

    if (!installerId) {
      const exePath = electron.remote.app.getPath('exe');
      const installerNamePath = path.join(path.dirname(exePath), 'installername');

      if (fs.existsSync(installerNamePath)) {
        try {
          const installerName = fs.readFileSync(installerNamePath).toString();

          if (installerName) {
            const matches = installerName.match(/\-([A-Za-z0-9]+)\.exe/);
            if (matches) {
              installerId = matches[1];
              localStorage.setItem('installerId', installerId);
            }
          }
        } catch (e) {
          console.error('Error loading installer id', e);
        }
      }
    }

    this.installerId = installerId;
  }

  get isProduction() {
    return process.env.NODE_ENV === 'production';
  }

  /**
   * Record a usage event on our server.
   * @param event the event type to record
   * @param metadata arbitrary data to store with the event (must be serializable)
   */
  recordEvent(event: TUsageEvent, metadata: object = {}) {
    if (!this.isProduction) return;

    let headers = new Headers();
    headers.append('Content-Type', 'application/json');

    // Don't check logged in because login may not be verified at this point
    if (this.userService.state.auth && this.userService.state.auth.primaryPlatform) {
      metadata['platform'] = this.userService.state.auth.primaryPlatform;
    }

    const bodyData: IUsageApiData = {
      event,
      slobs_user_id: this.userService.getLocalUserId(),
      version: this.version,
      data: JSON.stringify(metadata),
    };

    if (this.userService.state.auth && this.userService.state.auth.apiToken) {
      headers = authorizedHeaders(this.userService.apiToken, headers);
    }

    if (this.installerId) {
      bodyData.installer_id = this.installerId;
    }

    const request = new Request(`https://${this.hostsService.streamlabs}/api/v5/slobs/log`, {
      headers,
      method: 'POST',
      body: JSON.stringify(bodyData),
    });

    return fetch(request);
  }

  /**
   * Record event for the analytics DB
   */
  recordAnalyticsEvent(event: TAnalyticsEvent, value: any) {
    if (!this.isProduction) return;

    this.anaiticsEvents.push({
      event,
      value,
      product: 'SLOBS',
      version: this.version,
      count: 1,
      uuid: this.userService.getLocalUserId(),
    });
    this.sendAnalytics();
  }

  private sendAnalytics() {
    const data = { analyticsTokens: [...this.anaiticsEvents] };
    const headers = authorizedHeaders(this.userService.apiToken);
    headers.append('Content-Type', 'application/json');

    this.anaiticsEvents.length = 0;

    const request = new Request(`https://${this.hostsService.analitycs}/slobs/data/ping`, {
      headers,
      method: 'post',
      body: JSON.stringify(data || {}),
    });
    fetch(request).then(handleResponse);
  }
}
