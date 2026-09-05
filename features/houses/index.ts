// The slice's only door. Everything else in features/houses is private to it,
// and nothing here imports another slice — the room's profile actions arrive
// through render-prop slots composed in components/layout.
export { HouseRoom } from "./components/house-room";
export { HousesStreet } from "./components/houses-street";
export { OpenHouseSheet } from "./components/open-house-sheet";
export { isHouse, housePath, HOUSE_CATEGORY } from "./lib/house";
