import * as Location from "expo-location";
import { useEffect, useState } from "react";

import { STADIUM_COORDS } from "../constants/config";

/**
 * Calcula a distância em metros entre dois pontos usando a fórmula de Haversine.
 */
export function getDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6_371_000; // raio da Terra em metros
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export interface UseLocationResult {
  isInStadium: boolean;
  permissionDenied: boolean;
  multiplier: number;
}

/**
 * Verifica se o usuário está dentro do raio do estádio.
 * Retorna multiplicador 2x se dentro, 1x se fora ou sem permissão.
 */
export function useLocation(): UseLocationResult {
  const [isInStadium, setIsInStadium] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (cancelled) return;

      if (status !== "granted") {
        setPermissionDenied(true);
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      if (cancelled) return;

      const distance = getDistanceMeters(
        location.coords.latitude,
        location.coords.longitude,
        STADIUM_COORDS.latitude,
        STADIUM_COORDS.longitude,
      );

      setIsInStadium(distance <= STADIUM_COORDS.radiusMeters);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return {
    isInStadium,
    permissionDenied,
    multiplier: isInStadium ? 2 : 1,
  };
}
