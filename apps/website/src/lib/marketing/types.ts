export type MarketingLocationPublic = {
  id: string;
  name: string;
  addressLines: string[];
  phoneDisplay: string;
  telHref: string;
  hoursLabel: string;
  directionsUrl: string | null;
  /** WGS84; when both set, shown on /locations map */
  latitude: number | null;
  longitude: number | null;
};
