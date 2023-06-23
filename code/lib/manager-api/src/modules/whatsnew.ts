import { global } from '@storybook/global';
import type { WhatsNewCache, WhatsNewData } from '@storybook/core-events';
import {
  GET_WHATS_NEW_DATA,
  GET_WHATS_NEW_DATA_RESULT,
  SET_WHATS_NEW_CACHE,
} from '@storybook/core-events';
import type { ModuleFn } from '../index';

export type SubState = {
  whatsNewData?: WhatsNewData;
};

export type SubAPI = {
  isWhatsNewUnread(): boolean;
  whatsNewHasBeenRead(): void;
  whatsNewNotificationsEnabled(): boolean;
};

const WHATS_NEW_NOTIFICATION_ID = 'whats-new';

export const init: ModuleFn = ({ fullAPI, store }) => {
  const state: SubState = {
    whatsNewData: undefined,
  };

  function setWhatsNewState(newState: WhatsNewData) {
    store.setState({ whatsNewData: newState });
    state.whatsNewData = newState;
  }

  const api: SubAPI = {
    isWhatsNewUnread() {
      return state.whatsNewData?.status === 'SUCCESS' && !state.whatsNewData.postIsRead;
    },
    whatsNewHasBeenRead() {
      if (state.whatsNewData?.status === 'SUCCESS') {
        setWhatsNewCache({ lastReadPost: state.whatsNewData.url });
        setWhatsNewState({ ...state.whatsNewData, postIsRead: true });
        fullAPI.removeNotification(WHATS_NEW_NOTIFICATION_ID);
      }
    },
    whatsNewNotificationsEnabled() {
      return (
        (global.CONFIG_TYPE === 'DEVELOPMENT' && global.FEATURES.whatsNewNotifications) ?? false
      );
    },
  };

  function getLatestWhatsNewPost(): Promise<WhatsNewData> {
    fullAPI.emit(GET_WHATS_NEW_DATA);

    return new Promise((resolve) =>
      fullAPI.once(GET_WHATS_NEW_DATA_RESULT, ({ data }: { data: WhatsNewData }) => resolve(data))
    );
  }

  function setWhatsNewCache(cache: WhatsNewCache): void {
    fullAPI.emit(SET_WHATS_NEW_CACHE, cache);
  }

  const initModule = async () => {
    const whatsNewEnabled = api.whatsNewNotificationsEnabled();
    if (!whatsNewEnabled) return;

    const whatsNewData = await getLatestWhatsNewPost();
    setWhatsNewState(whatsNewData);

    const isNewStoryBookUser = fullAPI.getUrlState().path.includes('onboarding');

    if (
      whatsNewEnabled &&
      !isNewStoryBookUser &&
      whatsNewData.status === 'SUCCESS' &&
      whatsNewData.showNotification
    ) {
      fullAPI.addNotification({
        id: WHATS_NEW_NOTIFICATION_ID,
        link: '/settings/whats-new',
        content: {
          headline: whatsNewData.excerpt,
          subHeadline: "Click to learn what's new in Storybook",
        },
        icon: { name: 'hearthollow' },
        onClear() {
          setWhatsNewCache({ lastDismissedPost: whatsNewData.url });
        },
      });
    }
  };

  return { init: initModule, state, api };
};
