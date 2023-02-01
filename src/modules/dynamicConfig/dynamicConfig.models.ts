export type DynamicConfigEntity = {
    type: string;               // от него зависит поведение
    configTag: string;          // const, тег из configs
    textTag: string;            // const, тег из texts
    
    minValue?: number;          // мин. величина значения, может быть нужна для проверки (зависит от типа)
    maxValue?: number;          // макс.

    minAmount?: number,         // мин. количество значений, может быть нужна для проверки (зависит от типа)
    maxAmount?: number,         // макс.

    stringifiedText?: string;       // изменяемое, нужна для вывода текста в сообщении
    stringifiedTextEmoji?: string;  // изменяемое, нужна для вывода эмодзи в сообщениях
    value?: string;                 // изменяемое, ЗНАЧЕНИЕ этой переменной, которое импортируется в БД
    specialValue?: string;          // изменяемое, особое значение, которое может быть добавлено в компоненты, записывается как CONFIG_TAG-SPECIAL
    stringifiedValue?: string;      // изменяемое, нужна для вывода ЗНАЧЕНИЯ в сообщениях
    stringifiedModalValue?: string; // изменяемое, нужна для вывода ЗНАЧЕНИЯ в модальном окне
    errorText?: string;             // изменяемое, текст с ошибкой после проверки новой величины
};
