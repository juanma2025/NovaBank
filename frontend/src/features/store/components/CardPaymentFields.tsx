import { TextField } from '../../../components/TextField.tsx';
import { STORE_MESSAGES } from '../../../lib/messages.ts';
import { formatCardNumberGroups } from '../../cards/utils/card-expiry.ts';

export interface CardPaymentFieldsProps {
  cardNumber: string;
  expiry: string;
  cvv: string;
  disabled: boolean;
  cardNumberError?: string;
  expiryError?: string;
  cvvError?: string;
  shakeKey: number;
  onCardNumberChange: (value: string) => void;
  onExpiryChange: (value: string) => void;
  onCvvChange: (value: string) => void;
}

function formatExpiryInput(raw: string): string {
  const digits = raw.replace(/\D+/g, '').slice(0, 4);
  return digits.length <= 2 ? digits : `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

export function CardPaymentFields({
  cardNumber,
  expiry,
  cvv,
  disabled,
  cardNumberError,
  expiryError,
  cvvError,
  shakeKey,
  onCardNumberChange,
  onExpiryChange,
  onCvvChange,
}: CardPaymentFieldsProps) {
  return (
    <>
      <TextField
        label={STORE_MESSAGES.cardNumberLabel}
        name="cardNumber"
        inputMode="numeric"
        autoComplete="off"
        placeholder={STORE_MESSAGES.cardNumberPlaceholder}
        value={cardNumber}
        disabled={disabled}
        error={cardNumberError}
        shakeKey={shakeKey}
        onChange={(event) => onCardNumberChange(formatCardNumberGroups(event.target.value))}
      />

      <div className="grid grid-cols-2 gap-3">
        <TextField
          label={STORE_MESSAGES.expiryLabel}
          name="cardExpiry"
          inputMode="numeric"
          autoComplete="off"
          placeholder={STORE_MESSAGES.expiryPlaceholder}
          maxLength={5}
          value={expiry}
          disabled={disabled}
          error={expiryError}
          shakeKey={shakeKey}
          onChange={(event) => onExpiryChange(formatExpiryInput(event.target.value))}
        />

        <TextField
          label={STORE_MESSAGES.cvvLabel}
          name="cardCvv"
          inputMode="numeric"
          autoComplete="off"
          placeholder={STORE_MESSAGES.cvvPlaceholder}
          maxLength={3}
          value={cvv}
          disabled={disabled}
          error={cvvError}
          shakeKey={shakeKey}
          onChange={(event) => onCvvChange(event.target.value.replace(/\D+/g, '').slice(0, 3))}
        />
      </div>
    </>
  );
}
