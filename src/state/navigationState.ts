export type AppScreen = "paste" | "library" | "book" | "editor" | "reader";
export interface NavigationState { screen: AppScreen }
export const initialNavigationState: NavigationState = { screen: "library" };
