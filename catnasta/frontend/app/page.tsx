"use client"
import axios from "axios";
import { useEffect, useState } from "react";
import Loading from "./components/Loading";
import MqttChat from "./components/MqttChat";
import GameMenu from "./components/GameMenu";
import { api } from "./lib/api";
import Auth from "./components/Auth";
import Link from "next/link";

export default function Home() {
  const [text, setText] = useState("")
  useEffect(() => {
    const fetchData = async () => {
      const data = await axios.get(api + "/");
      setText(data.data)
    }
    fetchData()
  }, [])

  if (!text) {
    return <Loading />
  }

  return (
    <>
      <Auth />
      <Link href="/game" className="fixed top-0 left-0 btn btn-primary m-5">
        List of games
      </Link>
      <div className="hero min-h-screen bg-base-200">
        <div className="hero-content text-center">
          <div className="max-w-md">
            <div className="my-5">
              <h1 className="text-5xl font-bold">{text}</h1>
            </div>
            <GameMenu />
            <MqttChat />
          </div>
        </div>
      </div>
    </>
  );
}
