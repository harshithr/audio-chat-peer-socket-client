import { ConnectionTokenContext, Subscription } from "centrifuge";
import Centrifuge from "centrifuge/build/protobuf";
import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import Peer from "simple-peer";

interface Prop {
  channelName: string;
}

interface SubscriptionTrack {
  connection: "subscribing" | "subscribed" | "unsubscribed" | null;
  error: null | string;
}

interface ExecutorParams {
  username: string;
  channelName: string;
}

type PermissionLgs = {
  status: string;
  msg: string;
};

export const useCentrifugo = () => {
  // Centrifuge states
  const [centrifuge, setCentrifuge] = useState<null | Centrifuge>(null);
  const [subscription, setSubscription] = useState<null | Subscription>(null);

  const [userData, setUserData] = useState({
    token: null,
  });
  // const [triggerTokenRetriver, setTriggerTokenRetriver] = useState();
  const [subsTrack, setSubsTrack] = useState<SubscriptionTrack>({
    connection: null,
    error: null,
  });
  const [audioPermissionLogs, setAudioPermissionLogs] = useState<PermissionLgs>(
    {
      status: "",
      msg: "",
    }
  );

  const localStreamRef = useRef<MediaStream | null>(null);

  // ************
  // Use a function generator and executor function, once executor gets called
  // every thing should run

  // useEffect(() => {
  //   if (userData.token && !centrifuge) {
  //     const centrifuge = new Centrifuge(
  //       "ws://localhost:8000/connection/websocket",
  //       { token: userData.token }
  //     );

  //     centrifugoEvents(centrifuge);

  //     centrifugoConnect(centrifuge);

  //     setCentrifuge(centrifuge);
  //   }
  // }, [userData.token]);

  const centrifugeInstanceCreator = (token: string, username: string) => {
    if (token && !centrifuge) {
      const centrifugeInstance = new Centrifuge(
        "ws://localhost:8000/connection/websocket",
        {
          token,
          getToken: async () => {
            const response = await axios
              .post(`http://localhost:4000/users/rtc/auth`, {
                username,
              })
              .catch((e) => e);

            if (response.data && response.data.status) {
              const token = response.data.data.token;
              setUserData((ps) => ({ ...ps, token }));
              return token;
            }

            return "";
          },
          protocol: "protobuf",
        }
      );

      centrifugoEvents(centrifugeInstance);

      centrifugoConnect(centrifugeInstance);

      setCentrifuge(centrifugeInstance);

      return centrifugeInstance;
    } else if (token && centrifuge) {
      return centrifuge;
    }
  };

  const centrifugoEvents = (client: Centrifuge) => {
    if (!client && centrifuge) client = centrifuge;
    if (!client) return console.warn("Centrifuge instance not found");

    client
      .on("connecting", function (ctx) {
        console.log(`connecting: ${ctx.code}, ${ctx.reason}`);
      })
      .on("connected", function (ctx) {
        console.log(`connected over ${ctx.transport}`);
      })
      .on("disconnected", function (ctx) {
        console.log(`disconnected: ${ctx.code}, ${ctx.reason}`);
      });
  };

  const centrifugoConnect = (client: Centrifuge) => {
    if (!client && centrifuge) client = centrifuge;
    if (!client) return console.warn("Centrifuge instance not found");

    client.connect();
  };

  const centrifugoDisConnect = (client: Centrifuge) => {
    if (!client && centrifuge) client = centrifuge;
    if (!client) return console.warn("Centrifuge instance not found");

    client.connect();
  };

  const tokenRetriver = async (ctx: ConnectionTokenContext) => {
    const response = await axios
      .post(`http://localhost:4000/users/rtc/auth`, {
        username: ctx,
      })
      .catch((e) => e);

    if (response.data && response.data.status) {
      const token = response.data.data.token;
      setUserData((ps) => ({ ...ps, token }));
      return token;
    }

    return "";
  };

  const createNewSubscription = (
    centrifugeInstance: Centrifuge | null,
    channelName: string
  ) => {
    if (!centrifugeInstance && centrifuge) centrifugeInstance = centrifuge;
    if (!centrifugeInstance)
      return console.warn("Centrifuge instance not found");
    if (!channelName)
      return console.warn("Subscription channel name not found");

    // Check for existing channel
    const existingSubs = centrifugeInstance.getSubscription(channelName);
    if (existingSubs) {
      console.warn("Subscription already exists");
      setSubscription(existingSubs);

      subscriptionEvents(existingSubs);
      subscribeTrigger(existingSubs);
      return;
    }

    // Need to add subscription token
    const subs = centrifugeInstance.newSubscription(channelName);
    setSubscription(subs);

    subscriptionEvents(subs);
    subscribeTrigger(subs);

    publishStream(subs);
  };

  const handleAudioPermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });

      console.log(stream);

      localStreamRef.current = stream;

      // Do something with the audio stream, like setting it to an <audio> element
      // const audioElement = document.getElementById(
      //   "audioElement"
      // ) as HTMLAudioElement;
      // if (audioElement) {
      //   audioElement.srcObject = stream;
      //   audioElement.play();
      // }

      // simplePeerHandler(stream);


    } catch (e) {
      if (!e) return;
      const err = e.toString();
      if (err.includes("Requested device not found")) {
        setAudioPermissionLogs({
          status: "No audio device found",
          msg: "Device does not support audio recording",
        });
      }

      if (err.includes("Permission denied")) {
        setAudioPermissionLogs({
          status: "Permission denied",
          msg: "To continue audio call, please allow audio permission",
        });
      }
      console.error("Something wrong with audio permission: ", e);
    }
  };

  const publishStream = (subs: Subscription) => {
    if (!localStreamRef.current) return console.warn('No local stream available')
    subs.publish(localStreamRef.current)
  }

  const simplePeerHandler = (stream: MediaStream) => {
    if (!stream && localStreamRef.current) stream = localStreamRef.current;
    if (!stream) return console.warn("No local stream available");
    const peer = new Peer({ initiator: true, stream });

    // peer.on("signal", (data) => {
    //   // Send the signaling data to the other user (via your WebSocket server or any other means)
    //   console.log("Signaling data to the other user:", data);
    // });

    // peer.addStream(stream)

    peer.on("data", (data) => console.log("data: " + data));

    peer.on("stream", (stream) => {
      // remoteStreamRef.current.srcObject = stream;
      // setIsConnected(true);

      // Once the connection is established, send audio data to Centrifuge
      // sendAudioDataToCentrifuge(stream);
      console.log({ stream });

      const audioElement = document.getElementById(
        "audioElement"
      ) as HTMLAudioElement;
      if (audioElement) {
        audioElement.srcObject = stream;
        audioElement.play();
      }
    });
  };

  const executor = async ({ username, channelName }: ExecutorParams) => {
    handleAudioPermission();

    const token = await tokenRetriver(username);

    if (!token) return console.error("Token not found");

    const centrifugeInstance = centrifugeInstanceCreator(token, username);

    if (!centrifugeInstance)
      return console.error("Could not get centrifuge instance");

    createNewSubscription(centrifugeInstance, channelName);
  };

  const subscriptionEvents = (subs: Subscription) => {
    if (!subs && subscription) subs = subscription;
    if (!subs) return null;

    subs.on("subscribing", function (ctx) {
      setSubsTrack((ps) => ({
        ...ps,
        connection: "subscribing",
        error: ctx.reason && JSON.stringify(ctx),
      }));
    });

    subs.on("subscribed", function (ctx) {
      setSubsTrack((ps) => ({ ...ps, connection: "subscribed" }));
    });

    subs.on("unsubscribed", function (ctx) {
      setSubsTrack((ps) => ({
        ...ps,
        connection: "unsubscribed",
        error: ctx.reason && JSON.stringify(ctx),
      }));
    });

    subs.on("error", function (ctx) {
      console.error("subscription error", ctx);
      setSubsTrack((ps) => ({ ...ps, error: `subscription error, ${ctx}` }));
    });

    subs.on("publication", function (ctx) {
      console.log("Received publication: ", ctx);
    });
  };

  console.log({ subsTrack, userData });

  const subscribeTrigger = (subs: Subscription) => {
    if (!subs && subscription) subs = subscription;
    if (!subs) return null;
    subs.subscribe();
  };

  const unSubscribeTrigger = (subs: Subscription) => {
    if (!subs && subscription) subs = subscription;
    if (!subs) return null;
    subs.unsubscribe();
  };

  const removeSubscription = () => {
    if (!subscription || !centrifuge) return null;
    centrifuge.removeSubscription(subscription);
  };

  return {
    executor,
    createNewSubscription,
  };
};
