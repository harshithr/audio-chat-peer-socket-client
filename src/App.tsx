import { useEffect, useRef, useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import { useCentrifugo } from './useCentrifugo'
import { useSocket } from './useSocket'

function App() {
  const [count, setCount] = useState(0)
  const audioGridRef = useRef<HTMLDivElement | null>(null);

  const { executor } = useSocket({ audioGridRef })

  const handleClick = async () => {
    // const retriveStat = await tokenRetriver('harshith');

    // if (retriveStat) {
    //   createNewSubscription('testChannel')
    // }
    executor({ username: 'harshith', roomID: "TestRoom" })
  }

  return (
    <>
      <button onClick={handleClick}>Call</button>

      <div ref={audioGridRef} />
    </>
  )
}

export default App
