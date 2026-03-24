export const COUNTRY_NAMES: Record<string, string> = {
  US:"United States",GB:"United Kingdom",CA:"Canada",AU:"Australia",
  DE:"Germany",FR:"France",NL:"Netherlands",SE:"Sweden",NO:"Norway",
  DK:"Denmark",FI:"Finland",CH:"Switzerland",AT:"Austria",BE:"Belgium",
  IE:"Ireland",NZ:"New Zealand",SG:"Singapore",JP:"Japan",KR:"South Korea",
  IN:"India",BR:"Brazil",MX:"Mexico",AR:"Argentina",ZA:"South Africa",
  CN:"China",RU:"Russia",UA:"Ukraine",PL:"Poland",CZ:"Czechia",
  HU:"Hungary",RO:"Romania",PT:"Portugal",ES:"Spain",IT:"Italy",
  GR:"Greece",TR:"Turkey",IL:"Israel",AE:"UAE",SA:"Saudi Arabia",
};

export function countryName(code: string) {
  return COUNTRY_NAMES[code] ?? code;
}