import React from "react";
import Pusher from "pusher-js";
import { env } from "@/env";
import { __PROD__ } from "@/utils/constants";

const PusherContext = React.createContext<Pusher | null>(null);

const pusher = new Pusher(env.NEXT_PUBLIC_PUSHER_APP_KEY, {
  cluster: "docker",
  wsHost: env.NEXT_PUBLIC_PUSHER_HOST,
  wsPort: __PROD__ ? undefined : 6001,
  forceTLS: __PROD__,
  disableStats: true,
  enabledTransports: ["ws", "wss"],
});

export function PusherProvider(props: React.PropsWithChildren) {
  return (
    <PusherContext.Provider value={pusher}>
      {props.children}
    </PusherContext.Provider>
  );
}

export function usePusher() {
  const pusher = React.useContext(PusherContext);

  if (!pusher) {
    throw new Error("usePusher must be used within a PusherProvider");
  }

  return pusher;
}

export function useChannel(channelName: string) {
  const pusher = React.useContext(PusherContext);

  if (!pusher) {
    throw new Error("useChannel must be used within a PusherProvider");
  }

  const subscription = React.useMemo(
    () => pusher.subscribe(channelName),
    [channelName, pusher],
  );

  React.useEffect(() => {
    return () => {
      pusher.unsubscribe(channelName);
    };
  }, [pusher, channelName]);

  return subscription;
}
