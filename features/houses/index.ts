// The slice's only door. Everything else in features/houses is private to it,
// and nothing here imports another slice — the room's profile actions arrive
// through render-prop slots composed in components/layout.
export { HouseRoom } from "./components/house-room";
export { HousesStreet } from "./components/houses-street";
export { OpenHouseSheet } from "./components/open-house-sheet";
export { isHouse, housePath, HOUSE_CATEGORY } from "./lib/house";
export { RoomPeopleSection, GRID_CELLS, type RoomPerson } from "./components/room-people";
// Who a LiveKit participant is, from the token's metadata — the room card's preview names its active speaker through it.
export { parseParticipantMeta, participantName } from "./lib/participant-meta";
// The shell-owned room session (components/layout/room-session.tsx) builds its
// Room and mounts the room's audio through these, so the call outlives the view.
export { connectRoom } from "./hooks/use-house-connection";
export { HouseAudioSinks } from "./components/house-audio-sinks";
export { houseTopic } from "./lib/house";
