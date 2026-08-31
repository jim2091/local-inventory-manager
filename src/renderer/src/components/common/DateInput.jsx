import {
    forwardRef,
    useRef
} from 'react'

import DatePicker, {
    registerLocale
} from 'react-datepicker'

import { ko } from 'date-fns/locale'

import 'react-datepicker/dist/react-datepicker.css'

registerLocale('ko', ko)

function parseDateParts(value) {
    const [
        year = '',
        month = '',
        day = ''
    ] = String(
        value ?? ''
    ).split('-')

    return {
        year,
        month,
        day
    }
}

function stringToDate(value) {
    const match =
        String(value ?? '')
            .match(
                /^(\d{4})-(\d{2})-(\d{2})$/
            )

    if (!match) {
        return null
    }

    const year =
        Number(match[1])

    const month =
        Number(match[2])

    const day =
        Number(match[3])

    const date =
        new Date(
            year,
            month - 1,
            day
        )

    if (
        date.getFullYear() !== year ||
        date.getMonth() !== month - 1 ||
        date.getDate() !== day
    ) {
        return null
    }

    return date
}

function dateToString(date) {
    if (!date) {
        return ''
    }

    const year =
        date.getFullYear()

    const month =
        String(
            date.getMonth() + 1
        ).padStart(2, '0')

    const day =
        String(
            date.getDate()
        ).padStart(2, '0')

    return `${year}-${month}-${day}`
}

const CalendarButton =
    forwardRef(
        function CalendarButton(
            {
                onClick
            },
            ref
        ) {
            return (
                <button
                    ref={ref}
                    type="button"
                    className="date-calendar-button"
                    onClick={onClick}
                    aria-label="달력 열기"
                >
                    <svg
                        viewBox="0 0 24 24"
                        width="17"
                        height="17"
                        aria-hidden="true"
                    >
                        <path
                            d="M7 2v3M17 2v3M3.5 9h17M5 4h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                        />
                    </svg>
                </button>
            )
        }
    )

function getMaxDay(
    year,
    month
) {
    const yearNumber =
        Number(year)

    const monthNumber =
        Number(month)

    if (
        !Number.isInteger(yearNumber) ||
        !Number.isInteger(monthNumber) ||
        monthNumber < 1 ||
        monthNumber > 12
    ) {
        return 31
    }

    return new Date(
        yearNumber,
        monthNumber,
        0
    ).getDate()
}

function DateInput({
    value,
    onChange
}) {
    const yearRef =
        useRef(null)

    const monthRef =
        useRef(null)

    const dayRef =
        useRef(null)

    const {
        year,
        month,
        day
    } = parseDateParts(value)

    const makeDateValue = (
        newYear,
        newMonth,
        newDay
    ) => {
        onChange(
            `${newYear}-${newMonth}-${newDay}`
        )
    }

    const moveFocus = (
        targetRef
    ) => {
        requestAnimationFrame(() => {
            targetRef.current?.focus()
            targetRef.current?.select()
        })
    }

    const selectAll = (e) => {
        e.currentTarget.select()
    }

    const changeYear = (
        inputValue
    ) => {
        const newYear =
            inputValue
                .replace(
                    /[^0-9]/g,
                    ''
                )
                .slice(0, 4)

        let newDay = day

        // 연도가 완성되었을 때
        // 윤년 때문에 기존 일이 잘못될 수 있으므로 확인
        if (
            newYear.length === 4 &&
            month
        ) {
            const maxDay =
                getMaxDay(
                    newYear,
                    month
                )

            if (
                newDay &&
                Number(newDay) >
                maxDay
            ) {
                newDay = ''
            }
        }

        makeDateValue(
            newYear,
            month,
            newDay
        )

        if (
            newYear.length === 4
        ) {
            moveFocus(
                monthRef
            )
        }
    }

    const changeMonth = (
        inputValue
    ) => {
        let newMonth =
            inputValue
                .replace(
                    /[^0-9]/g,
                    ''
                )
                .slice(0, 2)

        if (!newMonth) {
            makeDateValue(
                year,
                '',
                day
            )

            return
        }

        const monthNumber =
            Number(newMonth)

        // 2~9는 더 이상 두 자리 월이 될 수 없으므로
        // 바로 02~09로 완성
        if (
            newMonth.length === 1 &&
            monthNumber >= 2 &&
            monthNumber <= 9
        ) {
            newMonth =
                newMonth.padStart(
                    2,
                    '0'
                )

            let newDay = day

            const maxDay =
                getMaxDay(
                    year,
                    newMonth
                )

            if (
                newDay &&
                Number(newDay) >
                maxDay
            ) {
                newDay = ''
            }

            makeDateValue(
                year,
                newMonth,
                newDay
            )

            moveFocus(
                dayRef
            )

            return
        }

        // 아직 0이나 1이면
        // 01~09 / 10~12 입력 가능성이 있으므로 기다림
        if (
            newMonth.length === 1
        ) {
            makeDateValue(
                year,
                newMonth,
                day
            )

            return
        }

        // 두 자리 월은 01~12만 가능
        if (
            monthNumber < 1 ||
            monthNumber > 12
        ) {
            return
        }

        let newDay = day

        const maxDay =
            getMaxDay(
                year,
                newMonth
            )

        if (
            newDay &&
            Number(newDay) >
            maxDay
        ) {
            newDay = ''
        }

        makeDateValue(
            year,
            newMonth,
            newDay
        )

        moveFocus(
            dayRef
        )
    }

    const changeDay = (
        inputValue
    ) => {
        let newDay =
            inputValue
                .replace(
                    /[^0-9]/g,
                    ''
                )
                .slice(0, 2)

        if (!newDay) {
            makeDateValue(
                year,
                month,
                ''
            )

            return
        }

        const dayNumber =
            Number(newDay)

        // 4~9는 40~99일이 존재하지 않으므로
        // 바로 04~09로 완성
        if (
            newDay.length === 1 &&
            dayNumber >= 4 &&
            dayNumber <= 9
        ) {
            newDay =
                newDay.padStart(
                    2,
                    '0'
                )

            makeDateValue(
                year,
                month,
                newDay
            )

            return
        }

        if (
            newDay.length === 1
        ) {
            makeDateValue(
                year,
                month,
                newDay
            )

            return
        }

        const maxDay =
            getMaxDay(
                year,
                month
            )

        if (
            dayNumber < 1 ||
            dayNumber > maxDay
        ) {
            return
        }

        makeDateValue(
            year,
            month,
            newDay
        )
    }

    const normalizeMonth = (
        inputValue
    ) => {
        if (!inputValue) {
            return
        }

        const monthNumber =
            Number(inputValue)

        if (
            monthNumber < 1 ||
            monthNumber > 12
        ) {
            makeDateValue(
                year,
                '',
                day
            )

            return
        }

        makeDateValue(
            year,
            String(
                monthNumber
            ).padStart(
                2,
                '0'
            ),
            day
        )
    }

    const normalizeDay = (
        inputValue
    ) => {
        if (!inputValue) {
            return
        }

        const dayNumber =
            Number(inputValue)

        const maxDay =
            getMaxDay(
                year,
                month
            )

        if (
            dayNumber < 1 ||
            dayNumber > maxDay
        ) {
            makeDateValue(
                year,
                month,
                ''
            )

            return
        }

        makeDateValue(
            year,
            month,
            String(
                dayNumber
            ).padStart(
                2,
                '0'
            )
        )
    }

    return (
        <div className="date-field-wrapper">
            <div className="date-segment-input">
                <input
                    ref={yearRef}
                    type="text"
                    inputMode="numeric"
                    maxLength="4"
                    value={year}
                    onChange={(e) =>
                        changeYear(
                            e.target.value
                        )
                    }
                    onFocus={selectAll}
                    onClick={selectAll}
                    placeholder="YYYY"
                    aria-label="연도"
                />

                <span className="date-separator">
                    /
                </span>

                <input
                    ref={monthRef}
                    type="text"
                    inputMode="numeric"
                    maxLength="2"
                    value={month}
                    onChange={(e) =>
                        changeMonth(
                            e.target.value
                        )
                    }

                    onFocus={selectAll}
                    onClick={selectAll}

                    onKeyDown={(e) => {
                        if (
                            e.key === 'Backspace' &&
                            !e.currentTarget.value
                        ) {
                            moveFocus(
                                yearRef
                            )
                        }
                    }}

                    onBlur={(e) =>
                        normalizeMonth(
                            e.currentTarget.value
                        )
                    }
                    placeholder="MM"
                    aria-label="월"
                />

                <span className="date-separator">
                    /
                </span>

                <input
                    ref={dayRef}
                    type="text"
                    inputMode="numeric"
                    maxLength="2"
                    value={day}
                    onChange={(e) =>
                        changeDay(
                            e.target.value
                        )
                    }

                    onFocus={selectAll}
                    onClick={selectAll}

                    onKeyDown={(e) => {
                        if (
                            e.key === 'Backspace' &&
                            !e.currentTarget.value
                        ) {
                            moveFocus(
                                monthRef
                            )
                        }
                    }}

                    onBlur={(e) =>
                        normalizeDay(
                            e.currentTarget.value
                        )
                    }
                    placeholder="DD"
                    aria-label="일"
                />
            </div>

            <DatePicker
                selected={
                    stringToDate(
                        value
                    )
                }
                onChange={(date) =>
                    onChange(
                        dateToString(
                            date
                        )
                    )
                }
                locale="ko"
                popperPlacement="bottom-start"
                showPopperArrow={false}
                customInput={
                    <CalendarButton />
                }
                renderCustomHeader={({
                    date,
                    decreaseMonth,
                    increaseMonth
                }) => (
                    <div className="custom-calendar-header">
                        <button
                            type="button"
                            onClick={
                                decreaseMonth
                            }
                        >
                            ‹
                        </button>

                        <strong>
                            {date.getFullYear()}년{' '}
                            {date.getMonth() + 1}월
                        </strong>

                        <button
                            type="button"
                            onClick={
                                increaseMonth
                            }
                        >
                            ›
                        </button>
                    </div>
                )}
            />
        </div>
    )
}

export default DateInput