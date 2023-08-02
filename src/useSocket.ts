import Peer, { CallOption, MediaConnection } from "peerjs";
import React, { RefObject, useState } from "react";
import { io } from "socket.io-client";

interface ExecutorParams {
  username: string,
  roomID: string
}

interface Prop {
  audioGridRef: RefObject<HTMLElement>
}

type PermissionLgs = {
  status: string;
  msg: string;
};

export const useSocket = ({ audioGridRef }: Prop) => {

  const [audioPermissionLogs, setAudioPermissionLogs] = useState<PermissionLgs>(
    {
      status: "",
      msg: "",
    }
  );
  const [error, setError] = useState<string | null>(null);
  const [peers, setPeers] = useState<{[key: string]: MediaConnection} | null>(null);


  // console.log({peers});
  
  const handleError = (error: string) => {
    console.error(error);
    setError(error);
  }

  const handleAudioPermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      // localStreamRef.current = stream;

      return stream;

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

  const addAudioStream = (audio: HTMLAudioElement, stream: MediaStream) => {
    audio.srcObject = stream;
    audio.play();

    console.log({audioDiv: audioGridRef.current});
    

    if (audioGridRef.current) audioGridRef.current.append(audio)
  }

  const connectToNewUser = (userId: string, stream: MediaStream, myPeer: Peer) => {
    const call = myPeer.call(userId, stream);

    console.log('Connecting to new user');
    
    const audioEle = document.createElement('audio');
    
    call.on('stream', userAudioStream => {
      console.log('Got the stream of new user');
      
      addAudioStream(audioEle, userAudioStream);
    });

    call.on('close', () => {
      console.log("Closed call connection");
      
      audioEle.remove();
    })

    setPeers(ps => {
      if (!ps) return { [userId]: call };

      return { ...ps, [userId]: call }
    })
  }

  const answerToOtherPeer = (myPeer: Peer, stream: MediaStream, ) => {
    myPeer.on('call', call => {
      console.log('Answering the other user call');
      
      call.answer(stream);

      const audioEle = document.createElement('audio');

      call.on('stream', userAudioStream => {
        addAudioStream(audioEle, userAudioStream)
      })
    })
  }
  
  const executor = async ({ username, roomID }: ExecutorParams) => {
    const socket = io('http://localhost:3434');
    const myPeer = new Peer('', {
      host: '/',
      port: 3434,
      path: '/peerjs',
    });

    const stream = await handleAudioPermission();

    
    if (!stream) return handleError('Could not get local audio stream, please refresh the page and try again')
    console.log(`Received local stream: `, stream);

    myPeer.on('open', id => {
      console.log('My Peer connection is open');
      
      socket.emit('join-room', roomID, { username, peerId: id });

      answerToOtherPeer(myPeer, stream);

      socket.on('user-connected', userData => {
        console.log({connected: true, userData});
        
        connectToNewUser(userData.peerId, stream, myPeer);
      })

    })


    myPeer.on('error', err => {
      handleError(JSON.stringify(err))
    })

    socket.on('user-disconnected', (userData) => {
      console.log(`User disconnected: `, userData);
      
      if (peers && peers[userData.peerId]) peers[userData.peerId].close();
    })    
  }

  return { executor }
}