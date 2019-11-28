/**
 * Units for distance
 */
enum DistanceUnits {
    StatuteMiles,
    Kilometers,
    NauticalMiles
  }
  
  /**
   * This routine calculates the distance between two points (given the latitude/longitude of those points)
   * @param lat1 - Latitude of point 1
   * @param lon1 - Longitude of point 1
   * @param lat2 - Latitude of point 2
   * @param lon2 - Longitude of point 2
   * @param unit - the unit you desire for results
   */
  export default function distance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
    unit: DistanceUnits = DistanceUnits.Kilometers
  ): number {
    if ((lat1 == lat2) && (lon1 == lon2)) {
      return 0;
    } else {
      const radlat1 = Math.PI * lat1 / 180;
      const radlat2 = Math.PI * lat2 / 180;
      const theta = lon1 - lon2;
      const radtheta = Math.PI * theta / 180;
      let dist = Math.sin(radlat1) * Math.sin(radlat2) + Math.cos(radlat1) * Math.cos(radlat2) * Math.cos(radtheta);
  
      if (dist > 1) {
        dist = 1;
      }
      dist = Math.acos(dist);
      dist = dist * 180 / Math.PI;
      dist = dist * 60 * 1.1515;
      if (unit == DistanceUnits.Kilometers) {
        dist = dist * 1609.344;
      }
      if (unit == DistanceUnits.NauticalMiles) {
        dist = dist * 0.8684;
      }
      return dist;
    }
  }
  