import { Observable } from 'rxjs';
import { TPlatform } from '../platforms';
import { IEncoderProfile } from '../video-encoding-optimizations';
import { ITwitchStartStreamOptions } from '../platforms/twitch';
import { IYoutubeStartStreamOptions } from '../platforms/youtube';
import { IFacebookStartStreamOptions } from '../platforms/facebook';
import { IMixerStartStreamOptions } from '../platforms/mixer';
import { IStreamError } from './stream-error';

export enum EStreamingState {
  Offline = 'offline',
  Starting = 'starting',
  Live = 'live',
  Ending = 'ending',
  Reconnecting = 'reconnecting',
}

export enum ERecordingState {
  Offline = 'offline',
  Starting = 'starting',
  Recording = 'recording',
  Stopping = 'stopping',
}

export enum EReplayBufferState {
  Running = 'running',
  Stopping = 'stopping',
  Offline = 'offline',
  Saving = 'saving',
}

export interface IStreamInfo {
  lifecycle:
    | 'empty' // platform settings are not synchronized
    | 'prepopulate' // stetting synchronization in progress
    | 'waitForNewSettings' // platform settings has been synchronized
    | 'runChecklist' // applying new settings and start the stream
    | 'live'; // stream has been successfully started
  error: IStreamError | null;
  checklist: {
    applyOptimizedSettings: TGoLiveChecklistItemState;
    twitch: TGoLiveChecklistItemState;
    youtube: TGoLiveChecklistItemState;
    facebook: TGoLiveChecklistItemState;
    mixer: TGoLiveChecklistItemState;
    setupRestream: TGoLiveChecklistItemState;
    startVideoTransmission: TGoLiveChecklistItemState;
    publishYoutubeBroadcast: TGoLiveChecklistItemState;
    postTweet: TGoLiveChecklistItemState;
  };
}

export type TGoLiveChecklistItemState = 'not-started' | 'pending' | 'done' | 'failed';

export interface IStreamSettings {
  platforms: {
    twitch: IPlatformFlags & ITwitchStartStreamOptions;
    youtube: IPlatformFlags & IYoutubeStartStreamOptions;
    facebook: IPlatformFlags & IFacebookStartStreamOptions;
    mixer: IPlatformFlags & IMixerStartStreamOptions;
  };
  advancedMode: boolean;
}

export interface IGoLiveSettings extends IStreamSettings {
  optimizedProfile?: IEncoderProfile;
  tweetText: string;
}

export interface IPlatformCommonFields {
  title: string;
  description?: string;
  game?: string;
}

export interface IPlatformFlags {
  enabled: boolean;
  useCustomFields: boolean;
}

export interface IStreamingServiceState {
  streamingStatus: EStreamingState;
  streamingStatusTime: string;
  recordingStatus: ERecordingState;
  recordingStatusTime: string;
  replayBufferStatus: EReplayBufferState;
  replayBufferStatusTime: string;
  selectiveRecording: boolean;
  info: IStreamInfo;
}

export interface IStreamingServiceApi {
  getModel(): IStreamingServiceState;

  /**
   * Subscribe to be notified when the state
   * of the streaming output changes.
   */
  streamingStatusChange: Observable<EStreamingState>;

  /**
   * Subscribe to be notified when the state
   * of the streaming output changes.
   */
  recordingStatusChange: Observable<ERecordingState>;

  /**
   * This subscription receives no events and
   * will be removed in a future version.
   * @deprecated
   */
  streamingStateChange: Observable<void>;

  /**
   * @deprecated
   */
  startStreaming(): void;

  /**
   * @deprecated
   */
  stopStreaming(): void;

  /**
   * Toggle the streaming state
   */
  toggleStreaming(): Promise<never> | Promise<void>;

  /**
   * @deprecated
   */
  startRecording(): void;

  /**
   * @deprecated
   */
  stopRecording(): void;

  /**
   * Toggle the recording state
   */
  toggleRecording(): void;
}
