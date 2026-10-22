import { useState } from "react";
import { Text, View } from "react-native";
import type {
  CalEventCustomFieldType,
  CalEventRegistrationField,
} from "@/services/types/cal-events.types";
import {
  CAL_EVENT_CUSTOM_FIELD_TYPES,
  CAL_EVENT_SYSTEM_FIELD_LABELS,
  customFieldTypeHasOptions,
  slugForRegistrationField,
} from "@/utils/cal-event-edit";
import {
  ChoiceChips,
  EditSheet,
  EditTextField,
  ErrorText,
  FieldLabel,
  ListRow,
  moveItem,
  RowControls,
  SwitchRow,
  TextButton,
  useEditTheme,
} from "./EditControls";

const SLUG_PATTERN = /^[A-Za-z0-9_-]+$/;

// Text-like system fields that take a placeholder even when the event hasn't set one yet.
const SYSTEM_FIELDS_WITH_PLACEHOLDER = new Set([
  "email",
  "title",
  "notes",
  "guests",
  "rescheduleReason",
  "attendeePhoneNumber",
]);

// The guest always gives a name and a place to meet, so those can't be made optional or hidden.
const SYSTEM_FIELDS_WITHOUT_TOGGLES = new Set(["name", "location"]);

// Phone numbers a workflow adds to the form; the workflow owns them.
const WORKFLOW_FIELDS = new Set(["smsReminderNumber", "aiAgentCallPhoneNumber"]);

const isCustom = (field: CalEventRegistrationField) => field.field === "custom";
const isSplitName = (field: CalEventRegistrationField) =>
  field.field === "name" && field.variant === "splitName";

function fieldTitle(field: CalEventRegistrationField): string {
  const label = field.label?.trim();
  if (label) return label;
  if (isCustom(field)) return field.slug || "Untitled question";
  return CAL_EVENT_SYSTEM_FIELD_LABELS[field.field] ?? field.field;
}

function fieldSubtitle(field: CalEventRegistrationField): string {
  if (WORKFLOW_FIELDS.has(field.field)) return "Added by a workflow";
  const kind = isCustom(field)
    ? (CAL_EVENT_CUSTOM_FIELD_TYPES.find((option) => option.value === field.type)?.label ??
      "Question")
    : "Default";
  // The web's badge: Hidden wins, then Required / Optional.
  return [kind, field.hidden ? "Hidden" : field.required ? "Required" : "Optional"]
    .filter(Boolean)
    .join(" · ");
}

function systemHasPlaceholder(field: CalEventRegistrationField): boolean {
  if (isSplitName(field)) return false;
  return (
    typeof field.placeholder === "string" ||
    field.field === "name" ||
    SYSTEM_FIELDS_WITH_PLACEHOLDER.has(field.field)
  );
}

function customHasPlaceholder(type: CalEventCustomFieldType): boolean {
  return type !== "checkbox" && !customFieldTypeHasOptions(type);
}

interface QuestionDraft {
  /** The field as it was, or null for a new question. */
  original: CalEventRegistrationField | null;
  /** Where the field sits in the list, or null for a new question. */
  index: number | null;
  type: CalEventCustomFieldType;
  label: string;
  slug: string;
  /** A new question's identifier follows its label until the host types one. */
  slugEdited: boolean;
  placeholder: string;
  options: string[];
  required: boolean;
  hidden: boolean;
}

function draftFor(field: CalEventRegistrationField, index: number): QuestionDraft {
  return {
    original: field,
    index,
    type: field.type ?? "shortText",
    label: field.label ?? "",
    slug: field.slug ?? "",
    slugEdited: true,
    placeholder: field.placeholder ?? "",
    options: field.options?.length ? [...field.options] : [""],
    required: field.required ?? false,
    hidden: field.hidden ?? false,
  };
}

const NEW_DRAFT: QuestionDraft = {
  original: null,
  index: null,
  type: "shortText",
  label: "",
  slug: "",
  slugEdited: false,
  placeholder: "",
  options: [""],
  required: true,
  hidden: false,
};

/** Builds the field Done writes back: unknown keys of an edited field survive untouched. */
function fieldFromDraft(draft: QuestionDraft): CalEventRegistrationField {
  const original = draft.original;
  const label = draft.label.trim();
  const placeholder = draft.placeholder.trim();

  if (original && !isCustom(original)) {
    const next: CalEventRegistrationField = { ...original };
    if (!isSplitName(original)) {
      if (label) next.label = label;
      else delete next.label;
    }
    if (systemHasPlaceholder(original)) {
      if (placeholder) next.placeholder = placeholder;
      else delete next.placeholder;
    }
    if (!SYSTEM_FIELDS_WITHOUT_TOGGLES.has(original.field)) {
      if (typeof original.required === "boolean") next.required = draft.required;
      if (typeof original.hidden === "boolean") next.hidden = draft.hidden;
    }
    return next;
  }

  const next: CalEventRegistrationField = {
    ...original,
    field: "custom",
    type: draft.type,
    slug: draft.slug.trim(),
    label,
    required: draft.required,
    hidden: draft.hidden,
  };
  if (customHasPlaceholder(draft.type) && placeholder) next.placeholder = placeholder;
  else delete next.placeholder;
  if (customFieldTypeHasOptions(draft.type)) {
    next.options = draft.options.map((option) => option.trim()).filter(Boolean);
  } else delete next.options;
  // Settings that belong to another type would be rejected once the type changes.
  if (draft.type !== "longText") {
    delete next.minLength;
    delete next.maxLength;
  }
  if (draft.type !== "email") {
    delete next.excludeEmails;
    delete next.requireEmails;
  }
  return next;
}

export function RegistrationQuestionsField({
  fields,
  onChange,
  error,
}: {
  fields: CalEventRegistrationField[];
  onChange: (fields: CalEventRegistrationField[]) => void;
  error?: string;
}) {
  const [draft, setDraft] = useState<QuestionDraft | null>(null);

  const commit = () => {
    if (!draft) return;
    const field = fieldFromDraft(draft);
    onChange(
      draft.index === null
        ? [...fields, field]
        : fields.map((existing, index) => (index === draft.index ? field : existing))
    );
    setDraft(null);
  };

  return (
    <View style={{ gap: 10 }}>
      <FieldLabel
        label="Registration form"
        hint="Choose what information guests provide when they register for your event."
      />
      <View style={{ gap: 4 }}>
        {fields.map((field, index) => {
          const title = fieldTitle(field);
          const readOnly = WORKFLOW_FIELDS.has(field.field);
          return (
            <ListRow
              key={`${field.field}-${field.slug ?? ""}-${index}`}
              title={title}
              subtitle={fieldSubtitle(field)}
              onPress={readOnly ? undefined : () => setDraft(draftFor(field, index))}
              accessibilityHint="Edits this question"
              trailing={
                <RowControls
                  itemLabel={title}
                  onMoveUp={index > 0 ? () => onChange(moveItem(fields, index, -1)) : undefined}
                  onMoveDown={
                    index < fields.length - 1
                      ? () => onChange(moveItem(fields, index, 1))
                      : undefined
                  }
                  onRemove={
                    isCustom(field)
                      ? () => onChange(fields.filter((_, other) => other !== index))
                      : undefined
                  }
                />
              }
            />
          );
        })}
      </View>
      <TextButton icon="add" label="Add a question" onPress={() => setDraft(NEW_DRAFT)} />
      <ErrorText message={error} />
      <QuestionSheet
        draft={draft}
        fields={fields}
        onChange={setDraft}
        onCancel={() => setDraft(null)}
        onDone={commit}
      />
    </View>
  );
}

function QuestionSheet({
  draft,
  fields,
  onChange,
  onCancel,
  onDone,
}: {
  draft: QuestionDraft | null;
  fields: CalEventRegistrationField[];
  onChange: (draft: QuestionDraft) => void;
  onCancel: () => void;
  onDone: () => void;
}) {
  const theme = useEditTheme();
  const others = fields.filter((_, index) => index !== draft?.index);
  const custom = !draft?.original || isCustom(draft.original);

  let slugError: string | null = null;
  let doneDisabled = false;
  if (draft && custom) {
    const slug = draft.slug.trim();
    if (!slug) slugError = "Required";
    else if (!SLUG_PATTERN.test(slug)) slugError = "Use letters, numbers, - and _ only";
    else if (others.some((field) => field.slug === slug)) {
      slugError = "Another question uses this identifier";
    }
    doneDisabled =
      !draft.label.trim() ||
      slugError !== null ||
      (customFieldTypeHasOptions(draft.type) && !draft.options.some((option) => option.trim()));
  }

  const update = (patch: Partial<QuestionDraft>) => {
    if (draft) onChange({ ...draft, ...patch });
  };

  const setLabel = (label: string) =>
    update(
      draft?.slugEdited ? { label } : { label, slug: slugForRegistrationField(label, others) }
    );

  const setOption = (index: number, value: string) =>
    update({ options: draft?.options.map((option, i) => (i === index ? value : option)) });

  const original = draft?.original;
  const showToggles =
    custom || (original != null && !SYSTEM_FIELDS_WITHOUT_TOGGLES.has(original.field));

  return (
    <EditSheet
      visible={draft !== null}
      title={draft?.original ? "Edit question" : "Add question"}
      onCancel={onCancel}
      onDone={onDone}
      doneDisabled={doneDisabled}
    >
      {draft && custom ? (
        <>
          <ChoiceChips
            label="Input type"
            options={CAL_EVENT_CUSTOM_FIELD_TYPES}
            value={draft.type}
            onChange={(type) => update({ type })}
          />
          <EditTextField
            label="Label"
            value={draft.label}
            onChangeText={setLabel}
            placeholder="What should guests answer?"
            autoCapitalize="sentences"
          />
          <EditTextField
            label="Identifier"
            hint="Names this answer in booking data and webhooks."
            value={draft.slug}
            onChangeText={(slug) => update({ slug, slugEdited: true })}
            autoCapitalize="none"
            // Done stays greyed out meanwhile, so a fresh question shows no "Required" before the
            // host has typed a label or an identifier.
            error={draft.slugEdited || draft.label.trim() ? slugError : null}
          />
          {customHasPlaceholder(draft.type) ? (
            <EditTextField
              label="Placeholder"
              value={draft.placeholder}
              onChangeText={(placeholder) => update({ placeholder })}
              autoCapitalize="sentences"
            />
          ) : null}
          {customFieldTypeHasOptions(draft.type) ? (
            <View style={{ gap: 8 }}>
              <FieldLabel label="Options" hint="Add at least one." />
              {draft.options.map((option, index) => (
                <View
                  // biome-ignore lint/suspicious/noArrayIndexKey: options are plain strings that can repeat while typed
                  key={index}
                  style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
                >
                  <View style={{ flex: 1 }}>
                    <EditTextField
                      value={option}
                      onChangeText={(value) => setOption(index, value)}
                      placeholder={`Option ${index + 1}`}
                      accessibilityLabel={`Option ${index + 1}`}
                      autoCapitalize="sentences"
                    />
                  </View>
                  <RowControls
                    itemLabel={option.trim() || `option ${index + 1}`}
                    onRemove={
                      draft.options.length > 1
                        ? () => update({ options: draft.options.filter((_, i) => i !== index) })
                        : undefined
                    }
                  />
                </View>
              ))}
              <TextButton
                icon="add"
                label="Add option"
                onPress={() => update({ options: [...draft.options, ""] })}
              />
            </View>
          ) : null}
        </>
      ) : null}
      {draft && original && !custom ? (
        <>
          {isSplitName(original) ? (
            <Text style={{ color: theme.textSecondary, fontSize: 14 }}>
              Guests give a first and a last name. Change those labels on the web.
            </Text>
          ) : (
            <EditTextField
              label="Label"
              value={draft.label}
              onChangeText={(label) => update({ label })}
              placeholder={CAL_EVENT_SYSTEM_FIELD_LABELS[original.field]}
              autoCapitalize="sentences"
            />
          )}
          {systemHasPlaceholder(original) ? (
            <EditTextField
              label="Placeholder"
              value={draft.placeholder}
              onChangeText={(placeholder) => update({ placeholder })}
              autoCapitalize="sentences"
            />
          ) : null}
        </>
      ) : null}
      {draft && showToggles && (custom || typeof original?.required === "boolean") ? (
        <SwitchRow
          label="Required"
          value={draft.required}
          onValueChange={(required) => update({ required })}
        />
      ) : null}
      {draft && showToggles && (custom || typeof original?.hidden === "boolean") ? (
        <SwitchRow
          label="Hidden"
          hint="Not shown on the registration form"
          value={draft.hidden}
          onValueChange={(hidden) => update({ hidden })}
        />
      ) : null}
    </EditSheet>
  );
}
