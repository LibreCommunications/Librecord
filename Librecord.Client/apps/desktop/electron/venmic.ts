// Linux screen share audio via PipeWire using @vencord/venmic.
// Creates a virtual microphone that captures system audio, which the
// renderer can then pick up via getUserMedia and splice into the stream.

import { app } from "electron";

let patchBay: InstanceType<typeof import("@vencord/venmic").PatchBay> | null = null;
let available: boolean | null = null;

function getPatchBay() {
  if (patchBay) return patchBay;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { PatchBay } = require("@vencord/venmic") as typeof import("@vencord/venmic");
    if (!PatchBay.hasPipeWire()) {
      console.warn("venmic: PipeWire not available");
      available = false;
      return null;
    }
    patchBay = new PatchBay();
    available = true;
    return patchBay;
  } catch (e) {
    console.warn("venmic: failed to load native module", e);
    available = false;
    return null;
  }
}

export function isVenmicAvailable(): boolean {
  if (available !== null) return available;
  return !!getPatchBay();
}

export function startVenmic(): boolean {
  const pb = getPatchBay();
  if (!pb) return false;

  // Unlink any existing capture first
  pb.unlink();

  // Capture all system audio EXCEPT Electron's own output to avoid feedback
  const ok = pb.link({
    exclude: [
      { "node.name": "Chromium" },
      { "node.name": "chromium" },
      { "application.process.id": String(process.pid) },
    ],
    only_default_speakers: true,
  });

  if (!ok) {
    console.warn("venmic: failed to create PipeWire link");
    return false;
  }

  console.log("venmic: system audio capture started");
  return true;
}

export function stopVenmic(): void {
  if (patchBay) {
    patchBay.unlink();
    console.log("venmic: system audio capture stopped");
  }
}

export function listVenmicNodes(): Array<Record<string, string>> {
  const pb = getPatchBay();
  if (!pb) return [];
  return pb.list(["node.name", "application.name"]);
}

// Clean up on exit
app.on("will-quit", () => {
  stopVenmic();
});
