import { useContext } from "react";
import { PresenceContext } from "../context/PresenceContext";

export function usePresence() {
    return useContext(PresenceContext);
}
