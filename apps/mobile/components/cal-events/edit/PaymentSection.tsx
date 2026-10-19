import { Ionicons } from "@expo/vector-icons";
import { Text, View } from "react-native";
import type { CalEvent, CalEventLocation } from "@/services/calcom";
import {
  CAL_EVENT_CURRENCIES,
  type CalEventEditFormValues,
  type CalEventPriceValues,
  calEventLocationPriceValues,
  describeCalEventLocation,
  getAdmissionLocations,
  getCalEventPriceError,
  getCalPayMinimumChargeError,
} from "@/utils/cal-event-edit";
import {
  EditSection,
  EditTextField,
  ErrorText,
  HintText,
  SwitchRow,
  useEditTheme,
} from "./EditControls";
import { LOCATION_TYPE_LABELS } from "./LocationsSection";
import { SelectField } from "./SelectField";

type PaymentValues = Pick<
  CalEventEditFormValues,
  | "paymentEnabled"
  | "price"
  | "currency"
  | "locationPrices"
  | "paymentTimeoutMinutes"
  | "waitlistEnabled"
  | "requiresApproval"
>;

const LOCATION_ICONS: Record<CalEventLocation["type"], keyof typeof Ionicons.glyphMap> = {
  address: "location-outline",
  link: "link-outline",
  integration: "videocam-outline",
  organizersDefaultApp: "videocam-outline",
  unknown: "help-circle-outline",
};

/**
 * The web's Payment tab: the "Paid event" toggle, with a price per location, or one price for an
 * event without locations (stream only), then the payment deadline. Prices save with the form;
 * a location's price goes to its own endpoint. Once published, prices are locked.
 */
export function PaymentSection({
  event,
  locations,
  values,
  onChange,
  errors,
  showErrors,
}: {
  event: Pick<CalEvent, "publishedAt">;
  /** The event's locations as last fetched: the Locations tab changes them at once. */
  locations: CalEventLocation[];
  values: PaymentValues;
  onChange: (patch: Partial<PaymentValues>) => void;
  errors: { price?: string; locationPrices?: string; paymentTimeoutMinutes?: string };
  /** After the first Save, like the form's other errors. */
  showErrors: boolean;
}) {
  const theme = useEditTheme();
  const pricingLocked = event.publishedAt !== null;
  const paymentBlocked = values.waitlistEnabled && values.requiresApproval;
  const admission = getAdmissionLocations(locations);
  const perLocation = admission.length > 0;
  const paid = values.paymentEnabled && !paymentBlocked;

  // The minimum charge shows as it's typed, like the web; the rest after a Save.
  const priceError = (row: CalEventPriceValues) =>
    showErrors ? getCalEventPriceError(row) : getCalPayMinimumChargeError(row);
  const rowErrors = admission.map((location) =>
    priceError(calEventLocationPriceValues(values, location))
  );

  const setLocationPrice = (location: CalEventLocation, patch: Partial<CalEventPriceValues>) => {
    if (!location.id) return;
    onChange({
      locationPrices: {
        ...values.locationPrices,
        [location.id]: { ...calEventLocationPriceValues(values, location), ...patch },
      },
    });
  };

  const lockedNote = perLocation
    ? "Existing locations' prices are locked after publish. You can still add new locations and price them in the Locations tab."
    : "Price and currency can’t be changed after this event is published. The payment deadline still applies to future offers.";

  return (
    <EditSection title="Payment">
      <SwitchRow
        label="Paid event"
        hint={
          perLocation
            ? "Charge per location. Guests pay the price of the location they pick during RSVP; leave a location's price empty to keep it free."
            : "Charge guests for a spot. Guests pay via Cal Pay during RSVP; their seat is held until payment completes."
        }
        value={paid}
        disabled={paymentBlocked || pricingLocked}
        onValueChange={(enabled) =>
          // Like the web: turning it off drops the prices typed so far.
          onChange(
            enabled
              ? { paymentEnabled: true }
              : { paymentEnabled: false, price: "", locationPrices: {} }
          )
        }
      />
      {paymentBlocked ? (
        <HintText>Turn off approval or the waitlist to charge for this event.</HintText>
      ) : null}
      {pricingLocked && !paid ? <HintText>{lockedNote}</HintText> : null}

      {paid ? (
        <>
          {perLocation ? (
            <View style={{ gap: 8 }}>
              <View
                style={{
                  borderWidth: 1,
                  borderColor: theme.border,
                  borderRadius: 12,
                  backgroundColor: theme.background,
                }}
              >
                {admission.map((location, index) => {
                  const row = calEventLocationPriceValues(values, location);
                  const title = location.label?.trim() || LOCATION_TYPE_LABELS[location.type];
                  return (
                    <View
                      key={location.id ?? `${location.type}-${index}`}
                      style={{
                        gap: 10,
                        padding: 12,
                        borderTopWidth: index > 0 ? 1 : 0,
                        borderTopColor: theme.border,
                      }}
                    >
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                        <Ionicons
                          name={LOCATION_ICONS[location.type]}
                          size={16}
                          color={theme.textSecondary}
                        />
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: theme.text, fontSize: 15, fontWeight: "500" }}>
                            {title}
                          </Text>
                          <Text
                            style={{ color: theme.textSecondary, fontSize: 13 }}
                            numberOfLines={1}
                          >
                            {describeCalEventLocation(location)}
                          </Text>
                        </View>
                      </View>
                      <PriceFields
                        value={row}
                        onChange={(patch) => setLocationPrice(location, patch)}
                        locked={pricingLocked}
                        priceLabel={`${title} price`}
                        currencyLabel={`${title} currency`}
                        placeholder="Free"
                        error={rowErrors[index]}
                      />
                    </View>
                  );
                })}
              </View>
              {showErrors && errors.locationPrices && !rowErrors.some(Boolean) ? (
                <ErrorText message={errors.locationPrices} />
              ) : null}
              <HintText>Locations without a price stay free to attend.</HintText>
            </View>
          ) : (
            <PriceFields
              value={{ price: values.price, currency: values.currency }}
              onChange={onChange}
              locked={pricingLocked}
              priceLabel="Price"
              placeholder="10.00"
              error={(showErrors ? errors.price : null) ?? priceError(values)}
            />
          )}
          {pricingLocked ? <HintText>{lockedNote}</HintText> : null}
          <EditTextField
            label="Payment deadline (minutes)"
            hint="How long a guest's spot is held while they complete payment. After the deadline the spot is released. Leave empty to use the default (10 minutes)."
            value={values.paymentTimeoutMinutes}
            onChangeText={(text) => onChange({ paymentTimeoutMinutes: text.replace(/\D/g, "") })}
            placeholder="10"
            keyboardType="number-pad"
            maxLength={5}
            error={showErrors ? errors.paymentTimeoutMinutes : null}
          />
          <HintText>
            Payments are processed with Cal Pay. If approval is required, guests pay only after the
            host approves them.
          </HintText>
        </>
      ) : null}
    </EditSection>
  );
}

/** A price and its currency, side by side, like the web's price group. */
function PriceFields({
  value,
  onChange,
  locked,
  priceLabel,
  currencyLabel,
  placeholder,
  error,
}: {
  value: CalEventPriceValues;
  onChange: (patch: Partial<CalEventPriceValues>) => void;
  locked: boolean;
  priceLabel: string;
  /** The currency's name for screen readers, such as which location's; "Currency" otherwise. */
  currencyLabel?: string;
  placeholder: string;
  error?: string | null;
}) {
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 10 }}>
        <View style={{ flex: 3 }}>
          <EditTextField
            label="Price"
            accessibilityLabel={priceLabel}
            value={value.price}
            onChangeText={(price) => onChange({ price: price.replace(",", ".") })}
            placeholder={placeholder}
            keyboardType="decimal-pad"
            editable={!locked}
          />
        </View>
        <View style={{ flex: 2 }}>
          <SelectField
            label="Currency"
            accessibilityLabel={currencyLabel}
            options={CAL_EVENT_CURRENCIES}
            value={value.currency}
            onChange={(currency) => onChange({ currency })}
            disabled={locked}
          />
        </View>
      </View>
      <ErrorText message={error} />
    </View>
  );
}
