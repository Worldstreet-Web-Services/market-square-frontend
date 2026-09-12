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
