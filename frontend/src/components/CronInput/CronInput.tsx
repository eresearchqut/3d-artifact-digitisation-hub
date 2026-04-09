import React, {
  ChangeEvent,
  FunctionComponent,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  Button,
  Input,
  Separator,
  Stack,
  Flex,
} from '@chakra-ui/react';
import Select, { MultiValue, SingleValue } from 'react-select';
import cronstrue from 'cronstrue';
import { Tooltip } from '../ui/tooltip';

const monthsForLocale = (localeName?: string) => {
  const format = new Intl.DateTimeFormat(localeName, { month: 'long' }).format;
  return [...Array(12).keys()].map((month) =>
    format(new Date(Date.UTC(2021, month))),
  );
};

const monthOptions = (locale?: string) =>
  monthsForLocale(locale).map((month, index) => ({
    value: `${index + 1}`,
    label: month,
  }));

const daysOfWeekForLocale = (locale?: string) => {
  const format = new Intl.DateTimeFormat(locale, { weekday: 'long' }).format;
  return [...Array(7).keys()].map((day) =>
    format(new Date(Date.UTC(2021, 1, day))),
  );
};

const dayOfMonthOptions = [...Array(31).keys()].map((day, index) => ({
  value: `${index + 1}`,
  label: String(day + 1).padStart(2, '0'),
}));

const CRON_DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

const dayOfWeekOptions = (locale?: string) =>
  daysOfWeekForLocale(locale).map((day, index) => ({
    value: CRON_DAYS[index],
    label: day,
  }));

const minuteOptions = [...Array(60).keys()].map((minute, index) => ({
  value: `${index}`,
  label: String(minute).padStart(2, '0'),
}));

const hourOptions = [...Array(24).keys()].map((hour, index) => ({
  value: `${index}`,
  label: String(hour).padStart(2, '0'),
}));

export interface Option {
  value: string;
  label: string;
}

export interface CronState {
  minute: string[] | string;
  hour: string[] | string;
  dayOfMonth: string[] | string;
  month: string[] | string;
  dayOfWeek: string[] | string;
}

export interface CronDetailState {
  description?: string;
  error?: string;
}

export interface CronInputProps {
  value?: string;
  locale?: string;
  id?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  variant?: 'outline' | 'subtle' | 'flushed';
  disabled?: boolean;
  readOnly?: boolean;
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
}

const getCronOptions = (
  locale?: string,
): Record<keyof CronState, Option[]> => ({
  month: monthOptions(locale),
  dayOfMonth: dayOfMonthOptions,
  dayOfWeek: dayOfWeekOptions(locale),
  minute: minuteOptions,
  hour: hourOptions,
});

const CRON_FIELDS: Array<keyof CronState> = [
  'minute',
  'hour',
  'dayOfMonth',
  'month',
  'dayOfWeek',
];

const mapCronStateField = (
  cronState: CronState,
  cronOptions: Record<keyof CronState, Option[]>,
  field: keyof CronState,
): string => {
  const values = cronState[field];
  if (Array.isArray(values)) {
    if (values.length > 0) {
      const ranges: string[][] = [];
      for (const value of values) {
        const valueIndex = cronOptions[field].findIndex(
          (option) => option.value === value,
        );
        const currentRange = ranges.pop() || [];
        if (currentRange.length > 0) {
          const rangeStart = currentRange[0];
          const previousInRange = currentRange[1] || rangeStart;
          const previousIndex = cronOptions[field].findIndex(
            (option) => option.value === previousInRange,
          );
          if (valueIndex - previousIndex === 1) {
            ranges.push([rangeStart, value]);
          } else if (rangeStart === previousInRange) {
            ranges.push([rangeStart], [value]);
          } else {
            ranges.push([rangeStart, previousInRange], [value]);
          }
        } else {
          ranges.push([value]);
        }
      }
      return ranges.map((range) => range.join('-')).join(',');
    }
  } else if (values) {
    return `*/${values}`;
  }
  return '*';
};

const mapCronState = (
  cronState: CronState,
  cronOptions: Record<keyof CronState, Option[]>,
): string =>
  CRON_FIELDS.map((field) =>
    mapCronStateField(cronState, cronOptions, field),
  ).join(' ');

const parseCronSegment = (
  cronOptions: Option[],
  cronSegment: string,
): string[] | string => {
  if (cronSegment === '*') return [];
  if (cronSegment) {
    if (cronSegment.startsWith('*/')) {
      return cronSegment.split('/')[1] || '';
    }
    return cronSegment
      .split(',')
      .map((v) => v.split('-'))
      .map((cronRange) => {
        if (cronRange.length === 2) {
          const start = cronOptions.findIndex((o) => o.value === cronRange[0]);
          const end = cronOptions.findIndex((o) => o.value === cronRange[1]);
          return cronOptions.slice(start, end + 1).map((o) => o.value);
        }
        return cronRange;
      })
      .flat();
  }
  return [];
};

const parseCronValue = (
  cronOptions: Record<keyof CronState, Option[]>,
  cron: string,
): CronState =>
  CRON_FIELDS.reduce((state, field, index) => {
    state[field] = parseCronSegment(
      cronOptions[field],
      cron.split(' ')[index] ?? '*',
    );
    return state;
  }, {} as CronState);

export const CronInput: FunctionComponent<CronInputProps> = ({
  value = '* * * * *',
  id,
  onChange,
  locale,
  size = 'md',
  variant,
  disabled,
  readOnly,
}) => {
  const cronOptions = useMemo(() => getCronOptions(locale), [locale]);
  const cronState = parseCronValue(cronOptions, value);

  const [cronDetail, setCronDetail] = useState<CronDetailState>({});
  useEffect(() => {
    try {
      setCronDetail({ description: cronstrue.toString(value, { verbose: true }) });
    } catch (e) {
      setCronDetail({ error: String(e) });
    }
  }, [value]);

  const emitChange = (nextState: CronState) =>
    onChange?.({
      target: { value: mapCronState(nextState, cronOptions) },
    } as ChangeEvent<HTMLInputElement>);

  const selectedOptions = (field: keyof CronState): MultiValue<Option> | SingleValue<Option> => {
    const opts = cronOptions[field] || [];
    const v = cronState[field];
    if (Array.isArray(v)) {
      return opts.filter((o) => (v as string[]).includes(o.value));
    }
    return opts.find((o) => o.value === v) ?? null;
  };

  const onSelected = (
    field: keyof CronState,
    selected: MultiValue<Option> | SingleValue<Option>,
  ) => {
    let next: string[] | string | undefined;
    if (Array.isArray(selected)) {
      next = (selected as Option[])
        .sort(
          (a, b) =>
            cronOptions[field].findIndex((o) => o.value === a.value) -
            cronOptions[field].findIndex((o) => o.value === b.value),
        )
        .map((o) => o.value);
    } else if (selected) {
      next = (selected as Option).value;
    }
    emitChange({ ...cronState, [field]: next ?? [] });
  };

  const toggleFieldType = (field: keyof CronState) =>
    emitChange({
      ...cronState,
      [field]: Array.isArray(cronState[field]) ? '1' : [],
    });

  const CronSelectControl: FunctionComponent<{
    field: keyof CronState;
    placeholder: string;
  }> = ({ field, placeholder }) => {
    const val = selectedOptions(field);
    const hasRate = field === 'minute' || field === 'hour';
    const isMulti = Array.isArray(val);
    const opts = isMulti
      ? cronOptions[field]
      : cronOptions[field].filter(
          (o) => cronOptions[field].length % parseInt(o.value) === 0,
        );

    return (
      <Stack gap={1} minW="160px">
        <Select
          inputId={id ? `${id}_${field}` : undefined}
          isMulti={isMulti}
          isDisabled={disabled}
          placeholder={placeholder}
          value={val}
          options={opts}
          onChange={(s) => onSelected(field, s)}
          menuPortalTarget={document.body}
          styles={{ menuPortal: (base) => ({ ...base, zIndex: 9999 }) }}
        />
        {hasRate && (
          <Button
            variant="plain"
            size="xs"
            disabled={disabled || readOnly}
            onClick={() => toggleFieldType(field)}
          >
            {isMulti ? 'Switch to Rate' : 'Switch to Select'}
          </Button>
        )}
      </Stack>
    );
  };

  return (
    <Flex flexWrap="wrap" gap={3} align="flex-start">
      <Tooltip content={cronDetail.description || cronDetail.error || value}>
        <Input
          id={id}
          value={value}
          onChange={onChange}
          size={size}
          variant={variant}
          disabled={disabled}
          readOnly={readOnly}
          fontFamily="mono"
        />
      </Tooltip>
      <Separator orientation="vertical" h="auto" alignSelf="stretch" />
      <CronSelectControl field="minute" placeholder="Every minute" />
      <CronSelectControl field="hour" placeholder="Every hour" />
      <CronSelectControl field="dayOfMonth" placeholder="Every day of month" />
      <CronSelectControl field="month" placeholder="Every month" />
      <CronSelectControl field="dayOfWeek" placeholder="Every day of week" />
    </Flex>
  );
};

export default CronInput;
