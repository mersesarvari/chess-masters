import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { PlayIcon, CirclePause, Settings } from "lucide-react";

export default function App() {
  const [isBotRunning, setIsBotRunning] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [depth, setDepth] = useState(10);
  const [autoPlay, setAutoPlay] = useState(false);

  const toggleBot = () => {
    setIsBotRunning(!isBotRunning);
    // Here you would add the logic to actually start or stop the bot
  };

  return (
    <body className="bg-[#2f3437]">
      <div className="w-80 p-4 bg-[#2f3437] text-white">
        <header className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <ChessIcon className="w-6 h-6 mr-2 text-[#7fa650]" />
            <h1 className="text-xl font-bold">Chess Analysis Bot</h1>
          </div>
          <Button
            onClick={() => setShowSettings(!showSettings)}
            aria-label="Settings"
          >
            <Settings className="w-5 h-5 text-[#7fa650]" />
          </Button>
        </header>

        <main>
          <div className="flex justify-between items-center mb-4">
            <Button
              onClick={toggleBot}
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
        </main>

        <footer className="mt-4 text-center text-xs text-gray-400">
          Chess Analysis Bot v1.0
        </footer>
      </div>
    </body>
  );
}

function ChessIcon(props: any) {
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
