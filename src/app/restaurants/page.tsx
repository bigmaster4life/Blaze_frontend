"use client";
import Image from "next/image";
import { FormEvent, useCallback, useEffect, useState } from "react";
import api, { apiErrorMessage } from "@/utils/api";
import { useAuth } from "@/contexts/AuthContext";
type Restaurant = {
  id: number;
  name: string;
  city: string;
  address: string;
  latitude: number;
  longitude: number;
  phone: string;
  photo: string;
  is_active: boolean;
  is_open: boolean;
  periodic_payment: boolean;
  settlement_terms: string;
};
type Dish = {
  id: number;
  name: string;
  description: string;
  category: string;
  price: number;
  photo: string;
  is_available: boolean;
};
type Order = {
  id: number;
  restaurant: number;
  cash_remitted_at: string | null;
  restaurant_name: string;
  food_total: number;
  state: string;
  funding: string;
  settlement_terms: string;
  restaurant_paid_at: string | null;
  collected_at: string | null;
  collected_total: number | null;
  collected_blaze_due: string | null;
  version: number;
  lines: { name: string; quantity: number; unit_price: number }[];
  delivery: {
    id: number;
    status: string;
    delivery_fee: number;
    contact_name: string;
    contact_phone: string;
    dropoff_label: string;
  };
  events: {
    id: number;
    action: string;
    actor_id: number;
    created_at: string;
    details: Record<string, unknown>;
  }[];
};
const cities = [
  ["port_gentil", "Port-Gentil"],
  ["libreville", "Libreville"],
  ["owendo", "Owendo"],
  ["angondje", "Angondjé"],
  ["ntoum", "Ntoum"],
  ["kango", "Kango"],
  ["franceville", "Franceville"],
];
const money = (amount: number | string) =>
  `${Number(amount).toLocaleString("fr-FR")} FCFA`;
export default function RestaurantsPage() {
  const { user } = useAuth();
  const allowed =
    !!user &&
    (user.is_superuser ||
      (user.is_staff && user.user_type === "manager_staff"));
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [menu, setMenu] = useState<Dish[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [tab, setTab] = useState("orders");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [catalog, queue] = await Promise.all([
        api.get("/delivery/admin/restaurants/"),
        api.get("/delivery/operator/restaurant-orders/"),
      ]);
      setRestaurants(catalog.data);
      setOrders(Array.isArray(queue.data) ? queue.data : queue.data.results);
      setNext(queue.data.next ?? null);
    } catch (e) {
      setError(apiErrorMessage(e, "Chargement impossible."));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    if (allowed) void load();
    else setLoading(false);
  }, [allowed, load]);
  const loadMenu = useCallback(async () => {
    if (!selected) return;
    try {
      const { data } = await api.get("/delivery/admin/menu/", {
        params: { restaurant: selected },
      });
      setMenu(data);
    } catch (e) {
      setError(apiErrorMessage(e, "Menu indisponible."));
    }
  }, [selected]);
  useEffect(() => {
    setMenu([]);
    if (allowed) void loadMenu();
  }, [allowed, loadMenu]);
  const mutate = async (action: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await action();
      await load();
      await loadMenu();
      setSuccess("Modification enregistrée.");
      setRevision((value) => value + 1);
    } catch (e) {
      setError(
        apiErrorMessage(e, "Enregistrement impossible. Rechargez et réessayez.")
      );
    } finally {
      setBusy(false);
    }
  };
  const createRestaurant = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const body = new FormData(form);
    const photo = body.get("photo");
    if (photo instanceof File && !photo.size) body.delete("photo");
    for (const key of ["is_active", "is_open", "periodic_payment"])
      body.set(key, String(body.get(key) === "on"));
    void mutate(async () => {
      await api.post("/delivery/admin/restaurants/", body);
      form.reset();
    });
  };
  const createDish = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selected) return;
    const form = event.currentTarget;
    const body = new FormData(form);
    const photo = body.get("photo");
    if (photo instanceof File && !photo.size) body.delete("photo");
    body.set("restaurant", String(selected));
    body.set("is_available", "true");
    void mutate(async () => {
      await api.post("/delivery/admin/menu/", body);
      form.reset();
    });
  };
  useEffect(() => {
    if (!allowed || busy || tab !== "orders") return;
    const timer = window.setInterval(() => {
      if (
        document.hidden ||
        document.activeElement?.matches("input,select,textarea")
      )
        return;
      api
        .get("/delivery/operator/restaurant-orders/")
        .then(({ data }) => {
          const fresh: Order[] = Array.isArray(data) ? data : data.results;
          // Preserve older pages and unmodified card forms while refreshing the first page.
          setOrders((previous) => [
            ...fresh,
            ...previous.filter(
              (order) => !fresh.some((row) => row.id === order.id)
            ),
          ]);
        })
        .catch(() =>
          setError(
            "Actualisation automatique interrompue. Utilisez Actualiser."
          )
        );
    }, 15000);
    return () => window.clearInterval(timer);
  }, [allowed, busy, tab]);
  if (!allowed)
    return (
      <div className="page-wrap">
        <h1>Restaurants & repas</h1>
        <p>Accès réservé aux gestionnaires habilités.</p>
      </div>
    );
  return (
    <main
      className="page-wrap"
      style={{ maxWidth: 1200, margin: "auto", padding: 28 }}
    >
      <h1>Restaurants & repas</h1>
      <p>
        Catalogue, préparation par Be et suivi des règlements. Les paiements
        électroniques clients restent désactivés.
      </p>
      <div style={{ display: "flex", gap: 12, margin: "20px 0" }}>
        <button className="button-primary" onClick={() => setTab("orders")}>
          Commandes opérateur
        </button>
        <button className="button-quiet" onClick={() => setTab("catalog")}>
          Restaurants et menus
        </button>
        <button className="button-quiet" onClick={() => setTab("balances")}>
          Règlements et reversements
        </button>
        <button disabled={busy} onClick={() => void load()}>
          Actualiser
        </button>
      </div>
      {error && (
        <p role="alert" style={{ color: "#b42318" }}>
          {error}
        </p>
      )}
      {success && <p role="status">{success}</p>}
      {loading && <p>Chargement…</p>}
      {tab === "balances" ? (
        <Balances
          restaurants={restaurants}
          revision={revision}
          busy={busy}
          mutate={mutate}
        />
      ) : tab === "catalog" ? (
        <>
          <section style={panel}>
            <h2>Ajouter un restaurant</h2>
            <form onSubmit={createRestaurant} style={grid}>
              <label>
                Nom
                <input name="name" required maxLength={160} />
              </label>
              <label>
                Ville
                <select name="city">
                  {cities.map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Adresse
                <input name="address" required maxLength={200} />
              </label>
              <label>
                Latitude
                <input
                  name="latitude"
                  required
                  type="number"
                  step="any"
                  min={-90}
                  max={90}
                />
              </label>
              <label>
                Longitude
                <input
                  name="longitude"
                  required
                  type="number"
                  step="any"
                  min={-180}
                  max={180}
                />
              </label>
              <label>
                Téléphone
                <input name="phone" maxLength={30} />
              </label>
              <label>
                Photo réelle (JPG/PNG/WebP, 5 Mo)
                <input
                  name="photo"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                />
              </label>
              <label>
                <input name="is_active" type="checkbox" /> Publié dans
                l’application
              </label>
              <label>
                <input name="is_open" type="checkbox" /> Accepte les commandes
              </label>
              <label>
                <input name="periodic_payment" type="checkbox" /> Accord de
                paiement périodique
              </label>
              <label>
                Modalités du contrat
                <input name="settlement_terms" maxLength={250} />
              </label>
              <button disabled={busy} className="button-primary">
                Créer le restaurant
              </button>
            </form>
            <p>
              Ne publiez que les restaurants partenaires et les photos dont vous
              avez l’autorisation. Aucune photo ne simule un plat réel.
            </p>
          </section>
          <section style={panel}>
            <h2>Catalogue</h2>
            {restaurants.map((restaurant) => (
              <div
                key={restaurant.id}
                style={{ padding: 14, borderBottom: "1px solid #ddd" }}
              >
                <strong>{restaurant.name}</strong> · {restaurant.city} ·{" "}
                {restaurant.address}
                <p>
                  {restaurant.periodic_payment
                    ? restaurant.settlement_terms
                    : "Règlement restaurant avant livraison"}
                </p>
                <button onClick={() => setSelected(restaurant.id)}>
                  Gérer le menu
                </button>{" "}
                <button
                  disabled={busy}
                  onClick={() =>
                    void mutate(() =>
                      api.patch(
                        `/delivery/admin/restaurants/${restaurant.id}/`,
                        { is_active: !restaurant.is_active }
                      )
                    )
                  }
                >
                  {restaurant.is_active ? "Masquer" : "Publier"}
                </button>{" "}
                <button
                  disabled={busy}
                  onClick={() =>
                    void mutate(() =>
                      api.patch(
                        `/delivery/admin/restaurants/${restaurant.id}/`,
                        { is_open: !restaurant.is_open }
                      )
                    )
                  }
                >
                  {restaurant.is_open
                    ? "Fermer les commandes"
                    : "Ouvrir les commandes"}
                </button>
                <RestaurantEditor
                  restaurant={restaurant}
                  busy={busy}
                  save={(body) =>
                    void mutate(() =>
                      api.patch(
                        `/delivery/admin/restaurants/${restaurant.id}/`,
                        body
                      )
                    )
                  }
                />
              </div>
            ))}
          </section>
          {selected && (
            <section style={panel}>
              <h2>
                Menu · {restaurants.find((row) => row.id === selected)?.name}
              </h2>
              <form onSubmit={createDish} style={grid}>
                <label>
                  Plat
                  <input name="name" required maxLength={160} />
                </label>
                <label>
                  Catégorie
                  <input name="category" maxLength={80} />
                </label>
                <label>
                  Prix FCFA
                  <input
                    name="price"
                    type="number"
                    min={1}
                    max={1000000}
                    step={1}
                    required
                  />
                </label>
                <label>
                  Description
                  <textarea name="description" maxLength={1500} />
                </label>
                <label>
                  Photo réelle
                  <input
                    name="photo"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                  />
                </label>
                <button disabled={busy} className="button-primary">
                  Ajouter le plat
                </button>
              </form>
              {menu.map((dish) => (
                <DishEditor
                  key={dish.id}
                  dish={dish}
                  busy={busy}
                  save={(body) =>
                    void mutate(() =>
                      api.patch(`/delivery/admin/menu/${dish.id}/`, body)
                    )
                  }
                />
              ))}
            </section>
          )}
        </>
      ) : (
        <>
          <section style={panel}>
            <h2>Commandes à traiter</h2>
            <p>
              Le livreur transporte les repas et collecte le total à la remise.
              Il n’avance pas leur prix. La commission de 22 % porte uniquement
              sur la livraison.
            </p>
            <p>
              La liste s’actualise toutes les 15 secondes lorsque vous ne
              saisissez pas un formulaire.
            </p>
          </section>
          {!loading && !orders.length && <p>Aucune commande restaurant.</p>}
          {orders.map((order) => (
            <OrderCard
              key={`${order.id}-${order.version}`}
              order={order}
              busy={busy}
              mutate={mutate}
            />
          ))}
          {next && (
            <button
              disabled={busy}
              onClick={() => {
                setBusy(true);
                api
                  .get("/delivery/operator/restaurant-orders/", {
                    params: {
                      page: new URL(
                        next,
                        window.location.origin
                      ).searchParams.get("page"),
                    },
                  })
                  .then(({ data }) => {
                    setOrders((old) => [...old, ...data.results]);
                    setNext(data.next);
                  })
                  .catch((e) => setError(apiErrorMessage(e)))
                  .finally(() => setBusy(false));
              }}
            >
              Voir plus
            </button>
          )}
        </>
      )}
    </main>
  );
}
const statusLabel = (state: string) =>
  ({
    pending: "À commander",
    confirmed: "Commandée",
    ready: "Prête",
    operator_required: "En attente de Be",
    searching: "Recherche du livreur",
    no_driver: "Aucun livreur disponible",
    assigned: "Livreur affecté",
    picked_up: "En livraison",
    delivered: "Livrée",
    delivered_by_driver: "Remise déclarée",
    confirmed_by_client: "Réception confirmée",
    cancelled: "Annulée",
    failed: "Échec",
  }[state] ?? state);
type Mutation = (action: () => Promise<unknown>) => Promise<void>;
function OrderCard({
  order,
  busy,
  mutate,
}: {
  order: Order;
  busy: boolean;
  mutate: Mutation;
}) {
  const [reference, setReference] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const [funding, setFunding] = useState("paid");
  const [confirmed, setConfirmed] = useState(false);
  const [received, setReceived] = useState(false);
  const [reason, setReason] = useState("");
  const advance = (row: Order, action: string) =>
    void mutate(() =>
      api.post(`/delivery/operator/restaurant-orders/${row.id}/advance/`, {
        action,
        reason,
        version: row.version,
        reference,
        funding,
        paid: confirmed,
        payment_reference: paymentReference,
        received,
        amount: row.collected_blaze_due,
      })
    );
  return (
    <section style={panel}>
      <h2>
        #{order.delivery.id} · {order.restaurant_name}
      </h2>
      <p>
        Restaurant : {statusLabel(order.state)} · Livraison :{" "}
        {statusLabel(order.delivery.status)}
      </p>
      <p>
        {order.delivery.contact_name} · {order.delivery.contact_phone} ·{" "}
        {order.delivery.dropoff_label}
      </p>
      <ul>
        {order.lines.map((line, i) => (
          <li key={i}>
            {line.quantity} × {line.name} —{" "}
            {money(line.quantity * line.unit_price)}
          </li>
        ))}
      </ul>
      <p>
        Repas {money(order.food_total)} + livraison{" "}
        {money(order.delivery.delivery_fee)} ={" "}
        <strong>
          {money(
            Number(order.food_total) + Number(order.delivery.delivery_fee)
          )}
        </strong>
      </p>
      <p>
        Restaurant :{" "}
        {order.restaurant_paid_at
          ? "Règlement enregistré"
          : order.funding === "contract_due"
          ? `À régler — ${order.settlement_terms}`
          : "À traiter"}
        . Client :{" "}
        {order.collected_at
          ? `Cash reçu par le livreur : ${money(order.collected_total ?? 0)}`
          : "Non encaissé"}
        .
      </p>
      {order.collected_blaze_due != null && (
        <p>
          À reverser par le livreur à Blaze : {money(order.collected_blaze_due)}{" "}
          (repas + commission livraison ; ce montant n’est pas un gain du
          livreur).
        </p>
      )}
      {order.cash_remitted_at && (
        <p>
          Reversement reçu par Blaze le{" "}
          {new Date(order.cash_remitted_at).toLocaleDateString("fr-FR")}.
        </p>
      )}
      {(order.state === "pending" ||
        (order.funding === "contract_due" && !order.restaurant_paid_at) ||
        (order.collected_at && !order.cash_remitted_at)) && (
        <fieldset
          disabled={busy}
          style={{ border: "1px solid #dce4df", padding: 18, marginBottom: 18 }}
        >
          <legend>
            Opération pour la commande #{order.delivery.id} uniquement
          </legend>
          <div style={grid}>
            {order.state === "pending" && (
              <>
                <label>
                  Référence restaurant
                  <input
                    value={reference}
                    maxLength={100}
                    onChange={(e) => setReference(e.target.value)}
                  />
                </label>
                <label>
                  Règlement restaurant
                  <select
                    value={funding}
                    onChange={(e) => setFunding(e.target.value)}
                  >
                    <option value="paid">Déjà payé par Be</option>
                    <option value="contract_due">
                      Selon le contrat périodique
                    </option>
                  </select>
                </label>
              </>
            )}
            <label>
              Référence du paiement / reversement
              <input
                value={paymentReference}
                maxLength={160}
                onChange={(e) => setPaymentReference(e.target.value)}
              />
            </label>
            <label>
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
              />{" "}
              Le paiement au restaurant a réellement été effectué.
            </label>
            {order.collected_at && !order.cash_remitted_at && (
              <label>
                <input
                  type="checkbox"
                  checked={received}
                  onChange={(e) => setReceived(e.target.checked)}
                />{" "}
                Blaze a réellement reçu {money(order.collected_blaze_due ?? 0)}{" "}
                du livreur.
              </label>
            )}
          </div>
        </fieldset>
      )}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {order.state === "pending" &&
          order.delivery.status === "operator_required" && (
            <button
              disabled={
                busy ||
                !reference ||
                (funding === "paid" && (!confirmed || !paymentReference))
              }
              onClick={() => advance(order, "confirm")}
            >
              Confirmer la commande au restaurant
            </button>
          )}
        {order.state === "confirmed" &&
          order.delivery.status === "operator_required" && (
            <button disabled={busy} onClick={() => advance(order, "ready")}>
              Commande prête : chercher un livreur
            </button>
          )}
        {order.state === "ready" && order.delivery.status === "no_driver" && (
          <button
            disabled={busy}
            onClick={() => advance(order, "retry_dispatch")}
          >
            Relancer la recherche
          </button>
        )}
        {order.funding === "contract_due" && !order.restaurant_paid_at && (
          <button
            disabled={busy || !confirmed || !paymentReference}
            onClick={() => advance(order, "settle_restaurant")}
          >
            Enregistrer le règlement au restaurant
          </button>
        )}
      </div>
      {order.collected_at &&
        !order.cash_remitted_at &&
        Number(order.collected_blaze_due) > 0 && (
          <button
            disabled={busy || !received || !paymentReference.trim()}
            onClick={() => advance(order, "record_remittance")}
          >
            Enregistrer le reversement reçu par Blaze
          </button>
        )}
      {order.state === "pending" &&
        order.delivery.status === "operator_required" && (
          <details style={{ marginTop: 16 }}>
            <summary>Le restaurant ne peut pas honorer cette commande</summary>
            <label>
              Motif
              <textarea
                value={reason}
                maxLength={500}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
            <button
              disabled={busy || !reason.trim()}
              onClick={() => advance(order, "reject")}
            >
              Confirmer le refus et informer le client
            </button>
          </details>
        )}
      <details>
        <summary>Journal des opérations</summary>
        {order.events.map((event) => (
          <p key={event.id}>
            {new Date(event.created_at).toLocaleString("fr-FR")} ·{" "}
            {event.action} · opérateur #{event.actor_id} ·{" "}
            {JSON.stringify(event.details)}
          </p>
        ))}
      </details>
    </section>
  );
}

type BalanceData = {
  restaurants: {
    restaurant_id: number;
    restaurant_name: string;
    amount: number;
    count: number;
  }[];
  couriers: {
    request__assigned_driver_id: number;
    request__assigned_driver__full_name: string;
    amount: string;
    count: number;
  }[];
};
function Balances({
  restaurants,
  revision,
  busy,
  mutate,
}: {
  restaurants: Restaurant[];
  revision: number;
  busy: boolean;
  mutate: Mutation;
}) {
  const [balances, setBalances] = useState<BalanceData>({
    restaurants: [],
    couriers: [],
  });
  const [restaurant, setRestaurant] = useState("");
  const [rows, setRows] = useState<Order[]>([]);
  const [ids, setIds] = useState<number[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const [paid, setPaid] = useState(false);
  const [key, setKey] = useState(() => crypto.randomUUID());
  useEffect(() => {
    let alive = true;
    setError("");
    api
      .get("/delivery/operator/restaurant-orders/balances/")
      .then(({ data }) => {
        if (alive) setBalances(data);
      })
      .catch((e) => {
        if (alive) setError(apiErrorMessage(e));
      });
    return () => {
      alive = false;
    };
  }, [revision]);
  useEffect(() => {
    let alive = true;
    setRows([]);
    setIds([]);
    setPaid(false);
    setPaymentReference("");
    setNext(null);
    setKey(crypto.randomUUID());
    if (!restaurant) return;
    api
      .get("/delivery/operator/restaurant-orders/", {
        params: { restaurant, unsettled: "1" },
      })
      .then(({ data }) => {
        if (alive) {
          setRows(Array.isArray(data) ? data : data.results);
          setNext(data.next ?? null);
        }
      })
      .catch((e) => {
        if (alive) setError(apiErrorMessage(e));
      });
    return () => {
      alive = false;
    };
  }, [restaurant, revision]);
  const selected = rows.filter((row) => ids.includes(row.id));
  const total = selected.reduce((sum, row) => sum + row.food_total, 0);
  return (
    <>
      <section style={panel}>
        <h2>Soldes à rapprocher</h2>
        <p>
          Les montants affichés correspondent aux opérations enregistrées. Le
          livreur conserve sa part des frais de livraison et reverse à Blaze les
          repas et la commission.
        </p>
        {error && <p role="alert">{error}</p>}
        <h3>Restaurants à payer selon contrat</h3>
        {balances.restaurants.length ? (
          balances.restaurants.map((row) => (
            <p key={row.restaurant_id}>
              {row.restaurant_name} : <strong>{money(row.amount)}</strong> ·{" "}
              {row.count} commandes
            </p>
          ))
        ) : (
          <p>Aucun règlement restaurant en attente.</p>
        )}
        <h3>Cash à recevoir des livreurs</h3>
        {balances.couriers.length ? (
          balances.couriers.map((row) => (
            <p key={row.request__assigned_driver_id}>
              {row.request__assigned_driver__full_name} (#
              {row.request__assigned_driver_id}) :{" "}
              <strong>{money(row.amount)}</strong> · {row.count} commandes
            </p>
          ))
        ) : (
          <p>Aucun reversement en attente.</p>
        )}
      </section>
      <section style={panel}>
        <h2>Enregistrer un règlement groupé au restaurant</h2>
        <p>
          Sélectionnez les commandes couvertes par le paiement déjà effectué.
          Aucun transfert bancaire n’est exécuté par cet écran.
        </p>
        <label>
          Restaurant
          <select
            value={restaurant}
            onChange={(e) => setRestaurant(e.target.value)}
          >
            <option value="">Choisir…</option>
            {restaurants.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
              </option>
            ))}
          </select>
        </label>
        {rows.map((row) => (
          <label key={row.id} style={{ display: "block", padding: 12 }}>
            <input
              type="checkbox"
              checked={ids.includes(row.id)}
              disabled={busy || (!ids.includes(row.id) && ids.length >= 100)}
              onChange={(e) =>
                setIds((old) =>
                  e.target.checked
                    ? [...old, row.id]
                    : old.filter((id) => id !== row.id)
                )
              }
            />{" "}
            Livraison #{row.delivery.id} · {row.restaurant_name} ·{" "}
            {money(row.food_total)} · {row.settlement_terms}
          </label>
        ))}
        {next && (
          <button
            disabled={busy}
            onClick={() => {
              api
                .get("/delivery/operator/restaurant-orders/", {
                  params: {
                    restaurant,
                    unsettled: "1",
                    page: new URL(
                      next,
                      window.location.origin
                    ).searchParams.get("page"),
                  },
                })
                .then(({ data }) => {
                  setRows((old) => [...old, ...data.results]);
                  setNext(data.next);
                })
                .catch((e) => setError(apiErrorMessage(e)));
            }}
          >
            Charger les commandes suivantes
          </button>
        )}
        <p>
          {ids.length} commandes sélectionnées · Total{" "}
          <strong>{money(total)}</strong>
        </p>
        <label>
          Référence du paiement effectué
          <input
            value={paymentReference}
            maxLength={160}
            onChange={(e) => setPaymentReference(e.target.value)}
          />
        </label>
        <label style={{ display: "block", margin: "16px 0" }}>
          <input
            type="checkbox"
            checked={paid}
            onChange={(e) => setPaid(e.target.checked)}
          />{" "}
          Je confirme le règlement de {money(total)} à ce restaurant.
        </label>
        <button
          disabled={busy || !ids.length || !paid || !paymentReference.trim()}
          onClick={() =>
            void mutate(() =>
              api.post("/delivery/operator/restaurant-orders/settle-batch/", {
                restaurant: Number(restaurant),
                orders: selected.map((row) => ({
                  id: row.id,
                  version: row.version,
                })),
                idempotency_key: key,
                payment_reference: paymentReference,
                paid,
              })
            )
          }
        >
          Enregistrer ce règlement groupé
        </button>
      </section>
    </>
  );
}
function RestaurantEditor({
  restaurant,
  busy,
  save,
}: {
  restaurant: Restaurant;
  busy: boolean;
  save: (body: FormData) => void;
}) {
  return (
    <details style={{ marginTop: 16 }}>
      <summary>Modifier les coordonnées, la photo et le contrat</summary>
      <form
        style={{ ...grid, marginTop: 16 }}
        onSubmit={(event) => {
          event.preventDefault();
          const body = new FormData(event.currentTarget);
          const photo = body.get("photo");
          if (photo instanceof File && !photo.size) body.delete("photo");
          body.set(
            "periodic_payment",
            String(body.get("periodic_payment") === "on")
          );
          save(body);
        }}
      >
        {restaurant.photo && (
          <Image
            unoptimized
            src={restaurant.photo}
            alt={restaurant.name}
            width={160}
            height={100}
            style={{ objectFit: "cover", borderRadius: 12 }}
          />
        )}
        <label>
          Nom
          <input
            name="name"
            required
            maxLength={160}
            defaultValue={restaurant.name}
          />
        </label>
        <label>
          Ville
          <select name="city" defaultValue={restaurant.city}>
            {cities.map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Adresse
          <input
            name="address"
            required
            maxLength={200}
            defaultValue={restaurant.address}
          />
        </label>
        <label>
          Téléphone
          <input name="phone" maxLength={30} defaultValue={restaurant.phone} />
        </label>
        <label>
          Latitude
          <input
            name="latitude"
            type="number"
            step="any"
            min={-90}
            max={90}
            required
            defaultValue={restaurant.latitude}
          />
        </label>
        <label>
          Longitude
          <input
            name="longitude"
            type="number"
            step="any"
            min={-180}
            max={180}
            required
            defaultValue={restaurant.longitude}
          />
        </label>
        <label>
          Remplacer la photo
          <input
            name="photo"
            type="file"
            accept="image/jpeg,image/png,image/webp"
          />
        </label>
        <label>
          <input
            name="periodic_payment"
            type="checkbox"
            defaultChecked={restaurant.periodic_payment}
          />{" "}
          Accord de paiement périodique
        </label>
        <label>
          Modalités du contrat
          <input
            name="settlement_terms"
            maxLength={250}
            defaultValue={restaurant.settlement_terms}
          />
        </label>
        <button disabled={busy}>Enregistrer les modifications</button>
      </form>
    </details>
  );
}
function DishEditor({
  dish,
  busy,
  save,
}: {
  dish: Dish;
  busy: boolean;
  save: (body: FormData) => void;
}) {
  return (
    <form
      style={{
        ...grid,
        marginTop: 24,
        paddingTop: 20,
        borderTop: "1px solid #ddd",
      }}
      onSubmit={(e) => {
        e.preventDefault();
        const body = new FormData(e.currentTarget);
        const photo = body.get("photo");
        if (photo instanceof File && !photo.size) body.delete("photo");
        body.set("is_available", String(body.get("is_available") === "on"));
        save(body);
      }}
    >
      {dish.photo && (
        <Image
          unoptimized
          src={dish.photo}
          alt={dish.name}
          width={120}
          height={90}
          style={{ objectFit: "cover", borderRadius: 12 }}
        />
      )}
      <label>
        Plat
        <input name="name" required defaultValue={dish.name} />
      </label>
      <label>
        Prix FCFA
        <input
          name="price"
          type="number"
          step={1}
          min={1}
          max={1000000}
          required
          defaultValue={dish.price}
        />
      </label>
      <label>
        Catégorie
        <input name="category" maxLength={80} defaultValue={dish.category} />
      </label>
      <label>
        Description
        <textarea
          name="description"
          maxLength={1500}
          defaultValue={dish.description}
        />
      </label>
      <label>
        <input
          type="checkbox"
          name="is_available"
          defaultChecked={dish.is_available}
        />{" "}
        Disponible
      </label>
      <label>
        Remplacer la photo
        <input
          name="photo"
          type="file"
          accept="image/jpeg,image/png,image/webp"
        />
      </label>
      <button disabled={busy}>Enregistrer ce plat</button>
    </form>
  );
}
const panel = {
  padding: 24,
  border: "1px solid #ddd",
  borderRadius: 18,
  background: "#fff",
  marginBottom: 24,
};
const grid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
  gap: 18,
};
