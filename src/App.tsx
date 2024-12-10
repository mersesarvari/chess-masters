"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { PlayIcon, CirclePause, Settings, LogIn } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function App() {
  const [versionOk, setVersionOk] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isBotRunning, setIsBotRunning] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [depth, setDepth] = useState(10);
  const [autoPlay, setAutoPlay] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    // Retrieve stored email and password from chrome storage
    chrome.storage.local.get(["email", "password", "running"], (result) => {
      if (result.email && result.password) {
        setEmail(result.email);
        setPassword(result.password);
        setIsLoggedIn(true);
      }
      if (result.running) {
        setIsBotRunning(result.running);
      }
    });
  }, []);

  //Version checker
  useEffect(() => {
    // Define an async function inside useEffect
    const fetchData = async () => {
      const url = "https://www.chessmaster.cloud/api/version";

      const requestData = {
        version: "1.0.0",
      };

      try {
        // Make the POST request
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestData),
        });

        // Parse the response as JSON
        const data = await response.json();
        if (data.status === 200) {
          setVersionOk(true);
        } else {
          setVersionOk(false);
        }

        console.log("Response:", data); // Handle the response data
      } catch (error) {
        setVersionOk(false);
        console.error("Error:", error); // Handle any errors
      }
    };

    // Call the async function
    fetchData();
  }, []);

  useEffect(() => {
    if (isLoggedIn) {
      chrome.runtime.sendMessage({
        action: isBotRunning ? "start" : "stop",
      });
      // Store the bot running status in chrome storage
      chrome.storage.local.set({ running: isBotRunning });
    }
  }, [isBotRunning, isLoggedIn]);

  const handleRegisterClick = (e: any) => {
    e.preventDefault(); // Prevent the default link behavior
    chrome.tabs.create({
      url: "https://www.chessmaster.cloud/register",
    });
  };

  const toggleBot = () => {
    setIsBotRunning((prev) => !prev);
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // Sending login command to auth.js
    chrome.runtime.sendMessage(
      {
        action: "login",
        email: email,
        password: password,
      },
      async function (response) {
        console.log(response);
        if (response.success) {
          // Store email and password in chrome storage
          setIsLoggedIn(true); // Update login state
          console.log("[APP.js]: Login successful");
          await chrome.storage.local.set({ email, password });
        }
      }
    );
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    chrome.storage.local.remove(["email", "password", "running"]); // Remove from chrome storage
    setIsBotRunning(false);
    setEmail(""); // Clear email state on logout
    setPassword(""); // Clear password state on logout
  };

  return (
    <div className="w-80 p-4 bg-[#2f3437] text-white">
      <header className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <ChessIcon className="w-6 h-6 mr-2 text-[#7fa650]" />
          <h1 className="text-xl font-bold">Chess Master Bot</h1>
        </div>
        {isLoggedIn && (
          <Button
            onClick={() => setShowSettings(!showSettings)}
            disabled
            aria-label="Settings"
          >
            <Settings className="w-5 h-5 text-[#7fa650]" />
          </Button>
        )}
      </header>

      <main>
        {!versionOk ? (
          <>
            <div className="flex justify-between items-center mb-4">
              <Button
                onClick={() => {
                  window.open(
                    "https://www.chessmaster.cloud/#download",
                    "_blank"
                  );
                }}
                id="startButton"
                className={`flex-1 bg-red-500 hover:bg-red-600`}
              >
                Outdated version! Click here to upgrade!
              </Button>
            </div>
          </>
        ) : (
          <>
            {!isLoggedIn ? (
              <Card className="bg-[#1a1a1a]">
                <CardHeader>
                  <CardTitle className="text-[#7fa650]">Login</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div className="space-y-2">
                      <label htmlFor="email" className="text-sm text-gray-400">
                        Email
                      </label>
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="bg-[#2f3437] border-[#424242] text-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <label
                        htmlFor="password"
                        className="text-sm text-gray-400"
                      >
                        Password
                      </label>
                      <Input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="bg-[#2f3437] border-[#424242] text-white"
                      />
                    </div>
                    <Button
                      type="submit"
                      className="w-full bg-[#7fa650] hover:bg-[#6c8c44]"
                    >
                      <LogIn className="w-4 h-4 mr-2" />
                      Log In
                    </Button>
                  </form>
                  <div className="mt-4 text-center">
                    <span className="text-sm text-gray-400">
                      Don't have an account?
                    </span>
                    <a
                      href="#"
                      onClick={handleRegisterClick} // Handle click event
                      className="text-sm text-[#7fa650] hover:underline ml-1"
                    >
                      Register here
                    </a>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="flex justify-between items-center mb-4">
                  <Button
                    onClick={toggleBot}
                    id="startButton"
                    className={`flex-1 ${
                      isBotRunning
                        ? "bg-red-500 hover:bg-red-600"
                        : "bg-[#7fa650] hover:bg-[#6c8c44]"
                    }`}
                  >
                    {isBotRunning ? (
                      <>
                        <CirclePause className="w-4 h-4 mr-2" />
                        Stop Bot
                      </>
                    ) : (
                      <>
                        <PlayIcon className="w-4 h-4 mr-2" />
                        Start Bot
                      </>
                    )}
                  </Button>
                </div>

                <div className="bg-[#1a1a1a] p-3 rounded-md mb-4">
                  <h2 className="text-sm font-semibold mb-2">Status</h2>
                  <p className="text-sm">
                    {isBotRunning
                      ? "Bot is analyzing the current position..."
                      : "Bot is inactive. Press Start to begin analysis."}
                  </p>
                </div>

                {showSettings && (
                  <div className="bg-[#1a1a1a] p-3 rounded-md mb-4">
                    <h2 className="text-sm font-semibold mb-2">Settings</h2>
                    <div className="flex items-center justify-between mb-2">
                      <label htmlFor="depth" className="text-sm">
                        Analysis Depth
                      </label>
                      <Slider
                        id="depth"
                        min={1}
                        max={20}
                        step={1}
                        value={[depth]}
                        onValueChange={(value) => setDepth(value[0])}
                        className="w-32"
                      />
                      <span className="text-sm ml-2">{depth}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <label htmlFor="autoPlay" className="text-sm">
                        Auto Play Best Move
                      </label>
                      <Switch
                        id="autoPlay"
                        checked={autoPlay}
                        onCheckedChange={setAutoPlay}
                      />
                    </div>
                  </div>
                )}

                <Button
                  onClick={handleLogout}
                  className="w-full mt-4 bg-[#424242] hover:bg-[#3a3a3a]"
                >
                  Log Out
                </Button>
              </>
            )}
          </>
        )}
      </main>

      <footer className="mt-4 text-center text-xs text-gray-400">
        Chess Analysis Bot v1.0
      </footer>
    </div>
  );
}

function ChessIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M8 16l-1.447.724a1 1 0 0 0-.553.894V20h12v-2.382a1 1 0 0 0-.553-.894L16 16H8z" />
      <path d="M8.5 16v-2.5h7V16" />
      <path d="M12 4v2.5" />
      <path d="M10.5 7.5h3" />
      <path d="M8 9l1 3h6l1-3" />
    </svg>
  );
}
