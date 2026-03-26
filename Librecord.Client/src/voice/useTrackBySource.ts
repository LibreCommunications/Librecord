import { useCallback, useSyncExternalStore } from "react";
import {
    RoomEvent,
    Track,
    type RemoteParticipant,
    type RemoteTrackPublication,
    type LocalTrackPublication,
} from "livekit-client";
import { getRoom, getParticipantTracks } from "./livekitClient";

/**
 * Reactive hook that returns a LiveKit Track for a given participant + source.
 *
 * Uses `useSyncExternalStore` to subscribe to the LiveKit Room — the
 * canonical React 18+ pattern for external mutable stores (same approach
 * as @livekit/components-react's observable-based hooks).
 *
 * Subscribes to RoomEvent.TrackSubscribed / TrackUnsubscribed (remote)
 * and RoomEvent.LocalTrackPublished / LocalTrackUnpublished (local) so
 * the returned value updates the instant the SFU delivers — no polling,
 * no custom events, no timeouts.
 */
export function useTrackBySource(
    identity: string,
    source: Track.Source,
): Track | null {
    const subscribe = useCallback(
        (onStoreChange: () => void) => {
            const room = getRoom();
            if (!room) return () => {};

            const isLocal = room.localParticipant.identity === identity;

            // Only fire when the event is for our identity + source
            const onRemoteTrack = (
                _track: Track,
                pub: RemoteTrackPublication,
                participant: RemoteParticipant,
            ) => {
                if (participant.identity === identity && pub.source === source) {
                    onStoreChange();
                }
            };

            const onLocalTrack = (pub: LocalTrackPublication) => {
                if (isLocal && pub.source === source) {
                    onStoreChange();
                }
            };

            room.on(RoomEvent.TrackSubscribed, onRemoteTrack);
            room.on(RoomEvent.TrackUnsubscribed, onRemoteTrack);
            room.on(RoomEvent.LocalTrackPublished, onLocalTrack);
            room.on(RoomEvent.LocalTrackUnpublished, onLocalTrack);

            return () => {
                room.off(RoomEvent.TrackSubscribed, onRemoteTrack);
                room.off(RoomEvent.TrackUnsubscribed, onRemoteTrack);
                room.off(RoomEvent.LocalTrackPublished, onLocalTrack);
                room.off(RoomEvent.LocalTrackUnpublished, onLocalTrack);
            };
        },
        [identity, source],
    );

    const getSnapshot = useCallback((): Track | null => {
        const tracks = getParticipantTracks(identity);
        if (source === Track.Source.Camera) return tracks.camera;
        if (source === Track.Source.ScreenShare) return tracks.screen;
        return null;
    }, [identity, source]);

    return useSyncExternalStore(subscribe, getSnapshot);
}
