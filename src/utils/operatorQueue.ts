import api from "./api";

export type DeliveryOperatorRequest = {
  id: number;
  type: string;
  pickup_zone: string | null;
  dropoff_zone: string | null;
  pickup_label: string;
  dropoff_label: string;
  contact_name: string;
  contact_phone: string;
  note: string;
  vehicle_type: string;
  status: string;
  created_at?: string;
};
export async function loadOperatorQueue(page = 1) {
  const { data } = await api.get("/delivery/operator/queue/", {
    params: { page },
  });
  const items: DeliveryOperatorRequest[] = Array.isArray(data)
    ? data
    : data?.results;
  if (!Array.isArray(items))
    throw new Error("La liste des demandes est indisponible.");
  const count = Array.isArray(data) ? items.length : data.count;
  if (!Number.isSafeInteger(count) || count < 0)
    throw new Error("La liste des demandes est indisponible.");
  const next =
    typeof data?.next === "string"
      ? new URL(data.next, "https://be.blazepro.org").searchParams.get("page")
      : null;
  return {
    items,
    count,
    nextPage: next && /^\d+$/.test(next) ? Number(next) : null,
  };
}
