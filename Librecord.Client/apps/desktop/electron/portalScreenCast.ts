// Calls org.freedesktop.portal.ScreenCast via D-Bus to show the native
// Wayland screen/window picker. Returns the PipeWire node ID of the
// selected stream.

import dbus from "dbus-next";

const BUS_NAME = "org.freedesktop.portal.Desktop";
const OBJ_PATH = "/org/freedesktop/portal/desktop";
const IFACE = "org.freedesktop.portal.ScreenCast";

export interface PortalStream {
  nodeId: number;
  sourceType: number;
  width: number;
  height: number;
}

let bus: dbus.MessageBus | null = null;
let requestCounter = 0;

function getBus(): dbus.MessageBus {
  if (!bus) bus = dbus.sessionBus();
  return bus;
}

function nextToken(): string {
  return `librecord_${++requestCounter}`;
}

function senderName(): string {
  return (getBus() as any).name.replace(/^:/, "").replace(/\./g, "_");
}

/**
 * Call a portal method and wait for the Response signal.
 * Uses bus-level signal matching instead of proxy objects to avoid
 * the race where the Request object doesn't exist yet.
 */
function callPortalMethod(
  screenCast: dbus.ClientInterface,
  method: string,
  args: unknown[],
  token: string,
): Promise<{ response: number; results: Record<string, any> }> {
  const requestPath = `${OBJ_PATH}/request/${senderName()}/${token}`;

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      sessionBus.removeListener("message", onMessage);
      reject(new Error("Portal request timed out"));
    }, 60000);

    const sessionBus = getBus();

    // Match Response signals on the request path
    const matchRule = `type='signal',interface='org.freedesktop.portal.Request',member='Response',path='${requestPath}'`;
    sessionBus.call(new dbus.Message({
      destination: "org.freedesktop.DBus",
      path: "/org/freedesktop/DBus",
      interface: "org.freedesktop.DBus",
      member: "AddMatch",
      signature: "s",
      body: [matchRule],
    })).catch(() => { /* ignore match errors */ });

    function onMessage(msg: dbus.Message) {
      if (
        msg.path === requestPath &&
        msg.interface === "org.freedesktop.portal.Request" &&
        msg.member === "Response"
      ) {
        clearTimeout(timeout);
        sessionBus.removeListener("message", onMessage);
        const [response, results] = msg.body;
        resolve({ response, results });
      }
    }

    sessionBus.on("message", onMessage);

    // Now make the actual method call
    (screenCast as any)[method](...args).catch((err: Error) => {
      clearTimeout(timeout);
      sessionBus.removeListener("message", onMessage);
      reject(err);
    });
  });
}

/**
 * Shows the native xdg-desktop-portal screen picker and returns the
 * selected PipeWire stream(s). Returns null if the user cancelled.
 */
export async function requestPortalScreenCast(): Promise<PortalStream[] | null> {
  const sessionBus = getBus();
  const portalObj = await sessionBus.getProxyObject(BUS_NAME, OBJ_PATH);
  const screenCast = portalObj.getInterface(IFACE);

  const Variant = dbus.Variant;

  // Step 1: CreateSession
  const sessionToken = nextToken();
  const createToken = nextToken();

  const { response: r1, results: sessionResults } = await callPortalMethod(
    screenCast,
    "CreateSession",
    [{
      handle_token: new Variant("s", createToken),
      session_handle_token: new Variant("s", sessionToken),
    }],
    createToken,
  );

  if (r1 !== 0) {
    console.warn("portal: CreateSession failed, response =", r1);
    return null;
  }

  const sessionHandle: string = sessionResults.session_handle?.value ?? sessionResults.session_handle;

  // Step 2: SelectSources
  const selectToken = nextToken();

  const { response: r2 } = await callPortalMethod(
    screenCast,
    "SelectSources",
    [sessionHandle, {
      handle_token: new Variant("s", selectToken),
      types: new Variant("u", 3),       // MONITOR | WINDOW
      multiple: new Variant("b", false),
      cursor_mode: new Variant("u", 2), // EMBEDDED
    }],
    selectToken,
  );

  if (r2 !== 0) {
    console.warn("portal: SelectSources failed, response =", r2);
    return null;
  }

  // Step 3: Start — this shows the native picker
  const startToken = nextToken();

  const { response: r3, results: startResults } = await callPortalMethod(
    screenCast,
    "Start",
    [sessionHandle, "", {
      handle_token: new Variant("s", startToken),
    }],
    startToken,
  );

  if (r3 !== 0) {
    return null; // User cancelled
  }

  const rawStreams = startResults.streams?.value ?? startResults.streams;
  const streams: PortalStream[] = rawStreams.map(
    ([nodeId, props]: [number, Record<string, any>]) => {
      const size = props.size?.value ?? props.size ?? [0, 0];
      return {
        nodeId,
        sourceType: props.source_type?.value ?? props.source_type ?? 0,
        width: size[0],
        height: size[1],
      };
    },
  );

  return streams;
}

export function cleanupBus(): void {
  if (bus) {
    bus.disconnect();
    bus = null;
  }
}
