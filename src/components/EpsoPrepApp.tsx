import { useEffect, useState } from 'preact/hooks';

type TopicId = 'percentages' | 'ratios' | 'averages' | 'tables' | 'charts' | 'currency';
type View = 'plan' | 'learn' | 'practice' | 'practiceDone' | 'mock' | 'review';

type Question = {
  id: number;
  topic: TopicId;
  label: string;
  prompt: string;
  table: ReadonlyArray<ReadonlyArray<string>>;
  answers: string[];
  correct: number;
  steps: string[];
  trap: string;
};

const epsoStyleTable = [
  ['Country', 'R&D % GDP 2022', 'R&D % GDP 2025', 'Govt share 2022', 'Govt share 2025', 'Patents / m', 'R&D €m', 'GDP / head €'],
  ['Alba', '1.90', '2.05', '20.0%', '24.0%', '145.6', '4,500', '19,330'],
  ['Boreal', '3.30', '3.45', '25.0%', '24.5%', '350.8', '3,000', '21,582'],
  ['Caspia', '2.15', '2.20', '38.7%', '39.0%', '139.5', '21,000', '18,874'],
  ['Doria', '2.45', '2.52', '31.4%', '31.2%', '307.0', '39,000', '20,261'],
  ['Estavia', '1.82', '1.76', '34.2%', '36.2%', '246.3', '6,000', '21,003']
] as const;

const topics: Record<TopicId, { number: string; title: string; summary: string; formula: string; move: string; trap: string }> = {
  percentages: { number: '01', title: 'Percentages', summary: 'Increases, decreases, percentage points and shares of a total.', formula: 'percentage change = (new − old) ÷ old × 100', move: 'Find the difference first. Divide by the starting value only when it asks for a percentage change.', trap: 'A change from 40% to 50% is 10 percentage points, not a 10% increase.' },
  ratios: { number: '02', title: 'Ratios & proportions', summary: 'Turn a ratio into a real amount by finding one part.', formula: 'one part = total ÷ (all ratio parts)', move: 'Add the ratio parts; find one part; then multiply by the share you need.', trap: 'Do not divide by just one side of the ratio.' },
  averages: { number: '03', title: 'Averages & rates', summary: 'Compare fairly by using per-person, per-item or average values.', formula: 'average = total ÷ number of items', move: 'Check the denominator. “Per employee” and “per project” ask different questions.', trap: 'The largest total is not always the highest rate.' },
  tables: { number: '04', title: 'Tables', summary: 'Filter a busy table down to the two or three cells that answer the question.', formula: 'write the operation before touching the numbers', move: 'Read the question first. Mark the row, column and unit you need.', trap: 'Do not add every number just because it is visible.' },
  charts: { number: '05', title: 'Charts & trends', summary: 'Read comparison, change and trend questions without being distracted by the graphic.', formula: 'difference = later value − earlier value', move: 'Name the two points being compared, then calculate.', trap: '“How many?” means difference. “What percentage?” needs a second division.' },
  currency: { number: '06', title: 'Money & conversion', summary: 'Handle discounts, exchange rates and costs using the direction stated in the table.', formula: 'new amount = original × rate', move: 'Write the unit beside every number: €, %, units or people.', trap: 'A 20% discount means multiply by 0.80, not 0.20.' }
};

const questions: Question[] = [
  { id: 1, topic: 'percentages', label: 'Percentage increase', prompt: 'Using the table, what was the percentage increase in East’s budget from 2022 to 2025?', table: [['Region', 'Budget 2022 €m', 'Budget 2025 €m', 'Share 2022', 'Share 2025'], ['North', '180', '225', '14%', '16%'], ['East', '240', '300', '20%', '23%'], ['South', '150', '195', '12%', '15%'], ['West', '230', '280', '18%', '20%']], answers: ['20%', '25%', '30%', '35%', 'None of the above'], correct: 1, steps: ['Take East’s budgets: €240m and €300m.', 'Find the increase: 300 − 240 = 60.', '60 ÷ 240 = 0.25, so the increase is 25%.'], trap: 'Percentage increase always uses the starting year as the denominator.' },
  { id: 2, topic: 'percentages', label: 'Percentage points', prompt: 'By how many percentage points did South’s support share change from 2022 to 2025?', table: [['Region', 'Budget 2022 €m', 'Budget 2025 €m', 'Share 2022', 'Share 2025'], ['North', '180', '225', '14%', '16%'], ['East', '240', '300', '20%', '23%'], ['South', '150', '195', '12%', '15%'], ['West', '230', '280', '18%', '20%']], answers: ['2 percentage points', '3 percentage points', '3%', '5 percentage points', 'None of the above'], correct: 1, steps: ['Read the two shares for South: 12% and 15%.', 'Subtract: 15 − 12 = 3.', 'Because both values are percentages, this is 3 percentage points.'], trap: 'Do not divide when the question asks for percentage points.' },
  { id: 3, topic: 'percentages', label: 'Share of a total', prompt: 'What share of the total 2025 budget came from West?', table: [['Region', 'Budget 2022 €m', 'Budget 2025 €m', 'Share 2022', 'Share 2025'], ['North', '180', '225', '14%', '16%'], ['East', '240', '300', '20%', '23%'], ['South', '150', '195', '12%', '15%'], ['West', '230', '280', '18%', '20%']], answers: ['25%', '28%', '30%', '32%', 'None of the above'], correct: 1, steps: ['Add the 2025 budgets: 225 + 300 + 195 + 280 = 1,000.', 'West contributes €280m.', '280 ÷ 1,000 = 0.28, so the share is 28%.'], trap: 'A share always compares one row with the total of the relevant column.' },
  { id: 4, topic: 'ratios', label: 'Ratio comparison', prompt: 'What is the ratio of Alpha’s Part A to Beta’s Part A?', table: [['Scheme', 'Part A', 'Part B', 'Part C', 'Total'], ['Alpha', '18', '30', '12', '60'], ['Beta', '24', '40', '16', '80'], ['Gamma', '15', '25', '10', '50'], ['Delta', '21', '35', '14', '70']], answers: ['2 : 3', '3 : 4', '4 : 3', '5 : 4', 'None of the above'], correct: 1, steps: ['Compare the Part A values only: 18 and 24.', 'Simplify 18:24 by dividing both sides by 6.', 'The ratio is 3:4.'], trap: 'Do not use the other columns unless the question says so.' },
  { id: 5, topic: 'ratios', label: 'Ratio within a row', prompt: 'What is the ratio of Gamma’s Part B to its Part C?', table: [['Scheme', 'Part A', 'Part B', 'Part C', 'Total'], ['Alpha', '18', '30', '12', '60'], ['Beta', '24', '40', '16', '80'], ['Gamma', '15', '25', '10', '50'], ['Delta', '21', '35', '14', '70']], answers: ['2 : 5', '3 : 2', '5 : 2', '4 : 1', 'None of the above'], correct: 2, steps: ['Read Gamma’s row: Part B = 25 and Part C = 10.', 'Write the ratio as 25:10.', 'Simplify by dividing both numbers by 5 to get 5:2.'], trap: 'Keep the parts in the order asked in the question.' },
  { id: 6, topic: 'ratios', label: 'Ratio pattern', prompt: 'Which scheme has a Part A to Part C ratio of 3:2?', table: [['Scheme', 'Part A', 'Part B', 'Part C', 'Total'], ['Alpha', '18', '30', '12', '60'], ['Beta', '24', '40', '16', '80'], ['Gamma', '15', '25', '10', '50'], ['Delta', '21', '35', '14', '70']], answers: ['Alpha', 'Beta', 'Gamma', 'Delta', 'None of the above'], correct: 2, steps: ['Check the Part A and Part C values in each row.', 'Gamma is 15:10, which simplifies to 3:2.', 'Gamma is the match.'], trap: 'Do not compare A to B or use the Total column.' },
  { id: 7, topic: 'averages', label: 'Average project cost', prompt: 'What was the average project cost across these four projects?', table: [['Project', 'Cost €', 'Team size', 'Days'], ['A', '18,000', '3', '12'], ['B', '22,000', '4', '14'], ['C', '16,000', '2', '10'], ['D', '24,000', '4', '15']], answers: ['€18,000', '€19,000', '€20,000', '€22,000', 'None of the above'], correct: 2, steps: ['Add the costs: 18,000 + 22,000 + 16,000 + 24,000 = 80,000.', 'There are 4 projects.', '80,000 ÷ 4 = 20,000, so the average is €20,000.'], trap: 'An average is a total divided by the number of items.' },
  { id: 8, topic: 'averages', label: 'Rate per employee', prompt: 'Which office processed the most cases per employee?', table: [['Office', 'Cases', 'Employees', 'Days open'], ['A', '420', '14', '21'], ['B', '510', '18', '17'], ['C', '336', '12', '16'], ['D', '465', '15', '15']], answers: ['Office A', 'Office B', 'Office C', 'Office D', 'None of the above'], correct: 3, steps: ['Divide cases by employees for each office.', 'A = 420 ÷ 14 = 30; B = 510 ÷ 18 = 28.3; C = 336 ÷ 12 = 28; D = 465 ÷ 15 = 31.', 'Office D has the highest rate.'], trap: 'Compare the rate, not the raw number of cases.' },
  { id: 9, topic: 'averages', label: 'Mean headcount', prompt: 'What was the average number of employees across the four offices?', table: [['Office', 'Cases', 'Employees', 'Days open'], ['A', '420', '14', '21'], ['B', '510', '18', '17'], ['C', '336', '12', '16'], ['D', '465', '15', '15']], answers: ['14', '14.5', '14.75', '15', 'None of the above'], correct: 2, steps: ['Add the employees: 14 + 18 + 12 + 15 = 59.', 'There are 4 offices.', '59 ÷ 4 = 14.75 employees on average.'], trap: 'The average can be a decimal even when the source values are whole numbers.' },
  { id: 10, topic: 'tables', label: 'Finding the largest value', prompt: 'Which country recorded the highest GDP per head in 2022?', table: epsoStyleTable as unknown as string[][], answers: ['Alba', 'Boreal', 'Caspia', 'Doria', 'Estavia'], correct: 1, steps: ['Read only the GDP / head € column.', 'Boreal has €21,582, which is higher than the other rows.', 'Boreal is the answer.'], trap: 'Do not compare the R&D columns when the question names GDP per head.' },
  { id: 11, topic: 'tables', label: 'Combining two rows', prompt: 'What was the combined R&D expenditure of Alba and Boreal in 2022?', table: epsoStyleTable as unknown as string[][], answers: ['€6,000m', '€7,500m', '€9,000m', '€10,500m', 'None of the above'], correct: 1, steps: ['Use the R&D €m column for Alba and Boreal.', '4,500 + 3,000 = 7,500.', 'The combined expenditure is €7,500m.'], trap: 'Use the named rows only and stay in the same column.' },
  { id: 12, topic: 'tables', label: 'Spotting a decline', prompt: 'Which country showed a decrease in R&D expenditure as a percentage of GDP from 2022 to 2025?', table: epsoStyleTable as unknown as string[][], answers: ['Alba', 'Boreal', 'Caspia', 'Doria', 'Estavia'], correct: 4, steps: ['Compare the 2022 and 2025 R&D % GDP values for each country.', 'Estavia changes from 1.82 to 1.76.', 'It is the only row that falls.'], trap: 'Read across the same row. Do not mix one country with another.' },
  { id: 13, topic: 'charts', label: 'Reading change', prompt: 'By how many did applications rise from Q1 to Q2?', table: [['Quarter', 'Applications', 'Training days', 'Completion rate'], ['Q1', '48', '12', '74%'], ['Q2', '60', '15', '78%'], ['Q3', '54', '13', '76%'], ['Q4', '66', '16', '80%']], answers: ['8', '10', '12', '14', 'None of the above'], correct: 2, steps: ['“By how many” asks for a difference.', 'Take the later value minus the earlier value: 60 − 48.', 'The rise was 12 applications.'], trap: 'A percentage increase would be a different question.' },
  { id: 14, topic: 'charts', label: 'Comparing growth', prompt: 'Which quarter had the highest completion rate?', table: [['Quarter', 'Applications', 'Training days', 'Completion rate'], ['Q1', '48', '12', '74%'], ['Q2', '60', '15', '78%'], ['Q3', '54', '13', '76%'], ['Q4', '66', '16', '80%']], answers: ['Q1', 'Q2', 'Q3', 'Q4', 'None of the above'], correct: 3, steps: ['Scan the completion rate column only.', 'The rates are 74%, 78%, 76% and 80%.', 'Q4 has the highest completion rate.'], trap: 'Do not compare the applications column when the question names completion rate.' },
  { id: 15, topic: 'charts', label: 'Overall change', prompt: 'What was the overall change in applications from Q1 to Q4?', table: [['Quarter', 'Applications', 'Training days', 'Completion rate'], ['Q1', '48', '12', '74%'], ['Q2', '60', '15', '78%'], ['Q3', '54', '13', '76%'], ['Q4', '66', '16', '80%']], answers: ['Increase of 16', 'Increase of 18', 'Increase of 20', 'Decrease of 18', 'None of the above'], correct: 1, steps: ['Compare the first and last values only: 48 and 66.', '66 − 48 = 18.', 'The overall change is an increase of 18.'], trap: 'A chart can move up and down in the middle; the overall change uses the endpoints.' },
  { id: 16, topic: 'currency', label: 'Discount', prompt: 'A training licence costs €250 and is reduced by 20%. What is the discounted price?', table: [['Item', 'Base price €', 'Discount', 'Rate'], ['Training licence', '250', '20%', '1 € = $1.25'], ['Study pack', '180', '15%', '1 € = $1.25'], ['Practice pass', '320', '25%', '1 € = $1.25'], ['Flashcards', '80', '10%', '1 € = $1.25']], answers: ['€50', '€180', '€200', '€220', 'None of the above'], correct: 2, steps: ['Find 20% of €250: 0.20 × 250 = 50.', 'Subtract the discount: 250 − 50.', 'The discounted price is €200.'], trap: 'The discount amount is not the final price.' },
  { id: 17, topic: 'currency', label: 'Exchange direction', prompt: 'An expense of €480 is converted at 1 euro = 1.25 dollars. What is the amount in dollars?', table: [['Item', 'Base price €', 'Discount', 'Rate'], ['Training licence', '250', '20%', '1 € = $1.25'], ['Study pack', '180', '15%', '1 € = $1.25'], ['Practice pass', '320', '25%', '1 € = $1.25'], ['Flashcards', '80', '10%', '1 € = $1.25']], answers: ['$480', '$520', '$600', '$720', 'None of the above'], correct: 2, steps: ['The exchange rate says each euro is worth $1.25.', 'Multiply 480 by 1.25.', '€480 becomes $600.'], trap: 'Read the rate in the correct direction before multiplying or dividing.' },
  { id: 18, topic: 'currency', label: 'Cost per item', prompt: 'A batch of 80 licences costs €3,600. What is the cost per licence?', table: [['Batch size', 'Total cost €', 'Discount', 'Rate'], ['80 licences', '3,600', '20%', '1 € = $1.25'], ['Study pack', '180', '15%', '1 € = $1.25'], ['Practice pass', '320', '25%', '1 € = $1.25'], ['Flashcards', '80', '10%', '1 € = $1.25']], answers: ['€40', '€42', '€45', '€50', 'None of the above'], correct: 2, steps: ['Divide the total cost by the number of licences.', '3,600 ÷ 80 = 45.', 'Each licence costs €45.'], trap: 'A per-item question always needs a division.' }
];
const mockQuestions: Question[] = [
  { id: 101, topic: 'ratios', label: 'Ratio from a reference table', prompt: 'In 2022, what was the ratio of R&D expenditure in Estavia to that in Boreal?', table: epsoStyleTable, answers: ['1 : 2', '2 : 1', '3 : 2', '6 : 5', 'None of the above'], correct: 1, steps: ['Use the R&D €m column only: Estavia 6,000 and Boreal 3,000.', 'Divide both values by 3,000.', 'The ratio is 2 : 1.'], trap: 'Do not use the R&D percentage-of-GDP column; the question asks for expenditure.' },
  { id: 102, topic: 'percentages', label: 'Percentage of a total', prompt: 'In 2022, how much of Alba’s R&D expenditure was funded by government?', table: epsoStyleTable, answers: ['€450m', '€720m', '€900m', '€1,080m', 'None of the above'], correct: 2, steps: ['Alba’s R&D expenditure is €4,500m and government share is 20.0%.', 'Calculate 20% of €4,500m: 0.20 × 4,500.', 'The amount is €900m.'], trap: 'Use the 2022 government-share column, not the 2025 column.' },
  { id: 103, topic: 'tables', label: 'Finding the largest value', prompt: 'Which country recorded the greatest number of patent applications per million inhabitants?', table: epsoStyleTable, answers: ['Alba', 'Boreal', 'Caspia', 'Doria', 'Estavia'], correct: 1, steps: ['Scan only the Patents / m column.', 'The values are 145.6, 350.8, 139.5, 307.0 and 246.3.', '350.8 is the largest, so the answer is Boreal.'], trap: 'Do not compare R&D expenditure; it is a different measure.' },
  { id: 104, topic: 'percentages', label: 'Percentage-point change', prompt: 'What was the increase in Alba’s R&D expenditure as a percentage of GDP between 2022 and 2025?', table: epsoStyleTable, answers: ['0.15 percentage points', '0.15%', '7.9 percentage points', '15 percentage points', 'None of the above'], correct: 0, steps: ['Use Alba’s R&D % GDP values: 1.90 and 2.05.', 'Subtract: 2.05 − 1.90 = 0.15.', 'Because both figures are already percentages, this is 0.15 percentage points.'], trap: 'Do not divide again when the question asks for percentage points.' },
  { id: 105, topic: 'tables', label: 'Comparing one column', prompt: 'Which country had the highest GDP per head in 2022?', table: epsoStyleTable, answers: ['Alba', 'Boreal', 'Caspia', 'Doria', 'Estavia'], correct: 1, steps: ['Read the GDP / head € column only.', 'Boreal is 21,582; Estavia is next at 21,003.', 'Boreal has the highest value.'], trap: 'GDP per head is not the same as total R&D expenditure.' },
  { id: 106, topic: 'charts', label: 'Spotting a decline', prompt: 'Which country showed a decrease in R&D expenditure as a percentage of GDP from 2022 to 2025?', table: epsoStyleTable, answers: ['Alba', 'Boreal', 'Caspia', 'Doria', 'Estavia'], correct: 4, steps: ['Compare the 2022 and 2025 R&D % GDP columns for each country.', 'Estavia changes from 1.82 to 1.76.', 'It is the only decrease.'], trap: 'Read across the same row; do not compare different countries.' },
  { id: 107, topic: 'percentages', label: 'Comparing changes', prompt: 'Which country had the largest increase in the share of R&D funded by government?', table: epsoStyleTable, answers: ['Alba', 'Boreal', 'Caspia', 'Doria', 'Estavia'], correct: 0, steps: ['Calculate each change in government share.', 'Alba rises by 4.0 points; Estavia rises by 2.0; Caspia rises by 0.3.', 'Alba has the largest increase.'], trap: 'Compare the change, not the final 2025 value.' },
  { id: 108, topic: 'tables', label: 'Applying two conditions', prompt: 'Which country had R&D expenditure below €5,000m and more than 300 patent applications per million inhabitants?', table: epsoStyleTable, answers: ['Alba', 'Boreal', 'Caspia', 'Doria', 'Estavia'], correct: 1, steps: ['Check the R&D €m column and Patents / m column together.', 'Boreal has €3,000m and 350.8 patents per million.', 'Boreal is the only country meeting both conditions.'], trap: 'Both conditions must be true for the same country.' },
  { id: 109, topic: 'averages', label: 'Adding selected values', prompt: 'What was the combined R&D expenditure of Alba and Boreal in 2022?', table: epsoStyleTable, answers: ['€6,000m', '€7,500m', '€9,000m', '€10,500m', 'None of the above'], correct: 1, steps: ['Use the R&D €m values for Alba and Boreal only.', '€4,500m + €3,000m = €7,500m.', 'The combined expenditure is €7,500m.'], trap: 'Do not include other countries in the total.' },
  { id: 110, topic: 'tables', label: 'Finding a difference', prompt: 'By how much was Boreal’s GDP per head higher than Alba’s in 2022?', table: epsoStyleTable, answers: ['€1,672', '€2,152', '€2,252', '€2,582', 'None of the above'], correct: 2, steps: ['Use the GDP / head € values: 21,582 and 19,330.', 'Subtract: 21,582 − 19,330.', 'Boreal’s GDP per head was €2,252 higher.'], trap: 'The question asks for a difference, not a ratio or percentage.' }
];

const Icon = ({ name }: { name: 'learn' | 'test' | 'review' | 'timer' | 'arrow' | 'check' }) => {
  const path = {
    learn: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H10v15H6.5A2.5 2.5 0 0 0 4 20.5v-15Z"/><path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H14v15h3.5a2.5 2.5 0 0 1 2.5 2.5v-15Z"/></>,
    test: <><rect x="4" y="3" width="16" height="18" rx="2"/><path d="m8 9 2 2 4-4M8 16h8"/></>,
    review: <><path d="M4 4h16v16H4z"/><path d="M8 9h8M8 13h5M8 17h7"/></>,
    timer: <><circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M9 2h6M12 2v3"/></>,
    arrow: <path d="M5 12h14m-6-6 6 6-6 6"/>,
    check: <path d="m5 12 4 4L19 6" />
  };
  return <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{path[name]}</svg>;
};

function format(seconds: number) { return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`; }

function randomInt(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }

function answerSetFive(correct: string, distractors: string[]) {
  const answers = [correct, ...distractors].sort(() => Math.random() - 0.5);
  return { answers, correct: answers.indexOf(correct) };
}

function simplifyRatio(a: number, b: number) {
  const gcd = (left: number, right: number): number => (right === 0 ? left : gcd(right, left % right));
  const divisor = gcd(a, b);
  return `${a / divisor} : ${b / divisor}`;
}

function generatePracticeQuestion(topic: TopicId): Question {
  const id = Date.now();
  if (topic === 'percentages') {
    const rows = [
      { region: 'North', start: 200, end: 240, share2022: '14%', share2025: '16%' },
      { region: 'East', start: 160, end: 200, share2022: '20%', share2025: '23%' },
      { region: 'South', start: 100, end: 130, share2022: '12%', share2025: '15%' },
      { region: 'West', start: 150, end: 210, share2022: '18%', share2025: '20%' }
    ] as const;
    const row = rows[randomInt(0, rows.length - 1)];
    const region = row.region;
    const start = row.start;
    const end = row.end;
    const rate = Math.round((end - start) / start * 100);
    const options = answerSetFive(`${rate}%`, [`${rate - 5}%`, `${rate + 10}%`, `${rate + 15}%`, `None of the above`]);
    return {
      id,
      topic,
      label: 'Fresh percentage increase',
      prompt: `Using the table, what was the percentage increase in ${region}’s budget from 2022 to 2025?`,
      table: [['Region', 'Budget 2022 €m', 'Budget 2025 €m', 'Share 2022', 'Share 2025'], ...rows.map((item) => [item.region, String(item.start), String(item.end), item.share2022, item.share2025])],
      ...options,
      steps: [`Use ${region}: €${start}m and €${end}m.`, `Find the increase: ${end} − ${start} = ${end - start}.`, `Divide by the starting value and convert to a percentage: ${rate}%.`],
      trap: 'Percentage increase always starts from the earlier value.'
    };
  }
  if (topic === 'ratios') {
    const tableRows = [
      { scheme: 'Alpha', partA: 18, partB: 30, partC: 12, total: 60 },
      { scheme: 'Beta', partA: 24, partB: 40, partC: 16, total: 80 },
      { scheme: 'Gamma', partA: 15, partB: 25, partC: 10, total: 50 },
      { scheme: 'Delta', partA: 21, partB: 35, partC: 14, total: 70 }
    ] as const;
    const row = tableRows[randomInt(0, tableRows.length - 1)];
    const ratio = simplifyRatio(row.partA, row.partB);
    const options = answerSetFive(ratio, ['2 : 3', '4 : 5', '5 : 4', 'None of the above']);
    return {
      id,
      topic,
      label: 'Fresh ratio comparison',
      prompt: `What is the ratio of ${row.scheme}’s Part A to its Part B?`,
      table: [['Scheme', 'Part A', 'Part B', 'Part C', 'Total'], ...tableRows.map((item) => [item.scheme, String(item.partA), String(item.partB), String(item.partC), String(item.total)])],
      ...options,
      steps: [`Read ${row.scheme}'s Part A and Part B values: ${row.partA} and ${row.partB}.`, `Write the ratio as ${row.partA}:${row.partB}.`, `Simplify to ${ratio}.`],
      trap: 'Keep the order exactly as the question gives it.'
    };
  }
  if (topic === 'averages') {
    const projectRows = [
      { project: 'A', cost: 18000, team: 3, days: 12 },
      { project: 'B', cost: 22000, team: 4, days: 14 },
      { project: 'C', cost: 16000, team: 2, days: 10 },
      { project: 'D', cost: 24000, team: 4, days: 15 }
    ] as const;
    const options = answerSetFive('€20,000', ['€18,000', '€19,000', '€22,000', 'None of the above']);
    return {
      id,
      topic,
      label: 'Fresh average',
      prompt: 'What was the average project cost across these four projects?',
      table: [['Project', 'Cost €', 'Team size', 'Days'], ...projectRows.map((item) => [item.project, `€${item.cost.toLocaleString('en-GB')}`, String(item.team), String(item.days)])],
      ...options,
      steps: ['Add the four project costs: €18,000 + €22,000 + €16,000 + €24,000 = €80,000.', 'There are four projects.', '€80,000 ÷ 4 = €20,000.'],
      trap: 'An average is the total divided by the count of values.'
    };
  }
  if (topic === 'tables') {
    const options = answerSetFive('Boreal', ['Alba', 'Caspia', 'Doria', 'None of the above']);
    const table = epsoStyleTable as unknown as string[][];
    return {
      id,
      topic,
      label: 'Fresh table comparison',
      prompt: 'Which country recorded the highest GDP per head in 2022?',
      table,
      ...options,
      steps: ['Read the GDP / head € column only.', 'Boreal has the highest value at €21,582.', 'Boreal is the correct answer.'],
      trap: 'Stay in the column named by the question.'
    };
  }
  if (topic === 'charts') {
    const chartRows = [
      { quarter: 'Q1', applications: 48, days: 12, completion: '74%' },
      { quarter: 'Q2', applications: 60, days: 15, completion: '78%' },
      { quarter: 'Q3', applications: 54, days: 13, completion: '76%' },
      { quarter: 'Q4', applications: 66, days: 16, completion: '80%' }
    ] as const;
    const options = answerSetFive('12', ['8', '10', '14', 'None of the above']);
    return {
      id,
      topic,
      label: 'Fresh chart change',
      prompt: 'By how many did applications rise from Q1 to Q2?',
      table: [['Quarter', 'Applications', 'Training days', 'Completion rate'], ...chartRows.map((item) => [item.quarter, String(item.applications), String(item.days), item.completion])],
      ...options,
      steps: ['Compare Q2 and Q1: 60 and 48.', 'Subtract 48 from 60.', 'The rise is 12 applications.'],
      trap: '“By how many” asks for a difference, not a percentage.'
    };
  }
  const price = 250;
  const discount = 20;
  const finalPrice = price * (100 - discount) / 100;
  const options = answerSetFive(`€${finalPrice}`, ['€50', '€180', '€220', 'None of the above']);
  return {
    id,
    topic,
    label: 'Fresh discount',
    prompt: `A training licence costs €${price} and is reduced by ${discount}%. What is the discounted price?`,
    table: [['Item', 'Base price €', 'Discount', 'Rate'], ['Training licence', '250', '20%', '1 € = $1.25'], ['Study pack', '180', '15%', '1 € = $1.25'], ['Practice pass', '320', '25%', '1 € = $1.25'], ['Flashcards', '80', '10%', '1 € = $1.25']],
    ...options,
    steps: [`Find 20% of €${price}: 0.20 × ${price} = €${price * discount / 100}.`, `Subtract the discount from €${price}.`, `The final price is €${finalPrice}.`],
    trap: 'The discount amount is not the final price.'
  };
}

function DataTable({ question }: { question: Question }) {
  return <div class="overflow-x-auto rounded-2xl border border-[#bdcbb5] bg-[#e8dcc7]"><table class="min-w-max w-full text-left text-[13px] leading-5 tabular-nums"><tbody>{question.table.map((row, r) => <tr class={r === 0 ? 'bg-[#8b9d83] font-bold text-[#1f331e]' : 'border-t border-[#c6d0bc]'}>{row.map((cell) => <td class="px-4 py-3 whitespace-nowrap sm:px-5">{cell}</td>)}</tr>)}</tbody></table></div>;
}

export default function EpsoPrepApp() {
  const [view, setView] = useState<View>('plan');
  const [topic, setTopic] = useState<TopicId>('percentages');
  const [practiceIndex, setPracticeIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [showMethod, setShowMethod] = useState(false);
  const [practiceSeconds, setPracticeSeconds] = useState(0);
  const [practiceScore, setPracticeScore] = useState(0);
  const [randomisedQuestions, setRandomisedQuestions] = useState<Record<number, Question>>({});
  const [mockStarted, setMockStarted] = useState(false);
  const [mockLeft, setMockLeft] = useState(20 * 60);
  const [mockIndex, setMockIndex] = useState(0);
  const [mockAnswers, setMockAnswers] = useState<Record<number, number>>({});
  const [history, setHistory] = useState<Array<{ correct: number; total: number; missed: number[] }>>([]);

  const practiceQuestions = questions.filter((question) => question.topic === topic);
  const practiceQuestion = randomisedQuestions[practiceIndex] ?? practiceQuestions[practiceIndex] ?? practiceQuestions[0];
  const mockQuestion = mockQuestions[mockIndex];
  const mockScore = Object.entries(mockAnswers).filter(([id, answer]) => mockQuestions.find((item) => item.id === Number(id))?.correct === answer).length;
  const missed = mockQuestions.filter((question) => mockAnswers[question.id] !== question.correct).map((question) => question.id);
  const totalAnswered = Object.keys(mockAnswers).length;

  useEffect(() => {
    try { const saved = localStorage.getItem('epso-prep-history'); if (saved) setHistory(JSON.parse(saved)); } catch { /* local storage is optional */ }
  }, []);
  useEffect(() => { if (history.length) localStorage.setItem('epso-prep-history', JSON.stringify(history.slice(0, 12))); }, [history]);
  useEffect(() => {
    if (view !== 'practice' || selected !== null) return;
    const id = window.setInterval(() => setPracticeSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(id);
  }, [view, selected, practiceIndex]);
  useEffect(() => {
    if (!mockStarted || mockLeft === 0) return;
    const id = window.setInterval(() => setMockLeft((value) => value - 1), 1000);
    return () => window.clearInterval(id);
  }, [mockStarted, mockLeft]);
  useEffect(() => {
    if (!mockStarted || mockLeft !== 0) return;
    setMockStarted(false);
    setHistory((items) => [{ correct: mockScore, total: mockQuestions.length, missed }, ...items]);
    setView('review');
  }, [mockLeft, mockStarted]);

  const openPractice = (id = topic) => {
    setTopic(id);
    setPracticeIndex(0); setPracticeScore(0); setRandomisedQuestions({});
    setPracticeSeconds(0); setSelected(null); setShowMethod(false); setView('practice');
  };
  const answerPractice = (answer: number) => { if (selected === null) { setSelected(answer); if (answer === practiceQuestion.correct) setPracticeScore((value) => value + 1); } };
  const nextPractice = () => {
    if (practiceIndex === practiceQuestions.length - 1) { setView('practiceDone'); return; }
    setPracticeIndex((value) => value + 1); setPracticeSeconds(0); setSelected(null); setShowMethod(false);
  };
  const randomisePracticeQuestion = () => { setRandomisedQuestions((items) => ({ ...items, [practiceIndex]: generatePracticeQuestion(topic) })); setSelected(null); setShowMethod(false); setPracticeSeconds(0); };
  const startMock = () => { setMockStarted(true); setMockLeft(20 * 60); setMockIndex(0); setMockAnswers({}); setView('mock'); };
  const finishMock = () => { if (!mockStarted) return; setMockStarted(false); setHistory((items) => [{ correct: mockScore, total: mockQuestions.length, missed }, ...items]); setView('review'); };
  const resetMock = () => { setMockStarted(false); setMockAnswers({}); setMockIndex(0); setMockLeft(20 * 60); };
  const currentTopic = topics[topic];
  const lessonExample = questions.find((question) => question.topic === topic)!;

  return <div class="min-h-screen bg-[#d4b895] text-[#314433]">
    <header class="border-b border-[#a7b59c] bg-[#e8dcc7]">
      <div class="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
        <button type="button" onClick={() => setView('plan')} class="flex items-center gap-3 text-left"><span class="grid h-9 w-9 place-items-center rounded-xl bg-[#b08b6e] font-mono text-sm font-bold text-[#243623]">E</span><span class="font-bold tracking-tight">EPSO Prep</span></button>
        <nav class="hidden rounded-full bg-[#c7cdb9] p-1 md:flex" aria-label="Practice areas">
          <button type="button" onClick={() => setView('plan')} class={`rounded-full px-4 py-2 text-sm font-bold ${view === 'plan' ? 'bg-[#e8dcc7]' : ''}`}>Plan</button>
          <button type="button" onClick={() => setView('learn')} class={`rounded-full px-4 py-2 text-sm font-bold ${view === 'learn' ? 'bg-[#e8dcc7]' : ''}`}>Learn</button>
          <button type="button" onClick={() => openPractice()} class={`rounded-full px-4 py-2 text-sm font-bold ${view === 'practice' ? 'bg-[#e8dcc7]' : ''}`}>Practice</button>
          <button type="button" onClick={startMock} class={`rounded-full px-4 py-2 text-sm font-bold ${view === 'mock' ? 'bg-[#e8dcc7]' : ''}`}>Mock test</button>
        </nav>
        <div class="rounded-full bg-[#8b9d83] px-3 py-2 text-xs font-bold text-[#1f331e]">{history.length ? `${history[0].correct}/${history[0].total} last mock` : 'Ready when you are'}</div>
      </div>
    </header>

    {view === 'practice' && <div class="border-b border-[#a7b59c] bg-[#c7d1bc]"><div class="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-3 sm:px-8"><p class="text-sm font-bold">Need another version of this example?</p><button type="button" onClick={randomisePracticeQuestion} class="rounded-full bg-[#606c38] px-4 py-2 text-sm font-bold text-[#e8dcc7] transition hover:-translate-y-0.5">Randomise this question</button></div></div>}

    <main class="mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:py-12">
      {view === 'plan' && <section>
        <div class="grid gap-6 rounded-[2rem] bg-[#606c38] p-7 text-[#e8dcc7] shadow-[0_20px_45px_rgba(49,68,51,.18)] lg:grid-cols-[1.15fr_.85fr] lg:p-10">
          <div><p class="font-mono text-xs font-bold tracking-[.14em] text-[#d4b895] uppercase">Numerical reasoning · one step at a time</p><h1 class="mt-4 max-w-2xl text-4xl font-bold tracking-[-.05em] sm:text-6xl">Turn tables and charts into decisions.</h1><p class="mt-5 max-w-xl text-base leading-7 text-[#e1dec7]">A calm practice space for building the exact habits numerical-reasoning questions reward: locate, choose, calculate, check.</p><div class="mt-7 flex flex-wrap gap-3"><button type="button" onClick={() => setView('learn')} class="inline-flex items-center gap-2 rounded-full bg-[#d4b895] px-5 py-3 text-sm font-bold text-[#314433] transition hover:-translate-y-0.5">Start learning <Icon name="arrow" /></button><button type="button" onClick={startMock} class="rounded-full border border-[#d4b895] px-5 py-3 text-sm font-bold text-[#e8dcc7]">Try the 20-minute mock</button></div></div>
          <div class="rounded-[1.5rem] bg-[#8b9d83] p-6 text-[#263c27]"><p class="font-mono text-xs font-bold tracking-[.12em] uppercase">Likely exam pattern</p><div class="mt-6 grid grid-cols-2 gap-3"><div class="rounded-2xl bg-[#e8dcc7] p-4"><p class="text-3xl font-bold">10</p><p class="mt-1 text-sm">multiple-choice questions</p></div><div class="rounded-2xl bg-[#e8dcc7] p-4"><p class="text-3xl font-bold">20 min</p><p class="mt-1 text-sm">in a recent EPSO notice</p></div></div><p class="mt-5 text-sm leading-6">Your specific competition invitation is the authority. This app uses the current 10-question, 20-minute numerical format as a practical target.</p></div>
        </div>
        <div class="mt-8 grid gap-5 md:grid-cols-3"><article class="rounded-[1.5rem] bg-[#e8dcc7] p-6"><Icon name="learn" /><h2 class="mt-5 text-xl font-bold">Learn the move</h2><p class="mt-2 text-sm leading-6">Six compact lessons explain the operation and the common trap before you practise.</p></article><article class="rounded-[1.5rem] bg-[#e8dcc7] p-6"><Icon name="test" /><h2 class="mt-5 text-xl font-bold">Practise safely</h2><p class="mt-2 text-sm leading-6">Work one question at a time. Reveal the method whenever you need it.</p></article><article class="rounded-[1.5rem] bg-[#e8dcc7] p-6"><Icon name="review" /><h2 class="mt-5 text-xl font-bold">Build test stamina</h2><p class="mt-2 text-sm leading-6">Use the mock only after the methods feel familiar; your last result is saved here.</p></article></div>
        <section class="mt-10"><div class="flex items-end justify-between"><div><p class="font-mono text-xs font-bold tracking-[.12em] uppercase">Your six skills</p><h2 class="mt-2 text-3xl font-bold tracking-[-.04em]">Choose a small starting point.</h2></div><button type="button" onClick={() => setView('learn')} class="hidden text-sm font-bold underline md:block">See all lessons</button></div><div class="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{Object.entries(topics).map(([id, item]) => <button type="button" onClick={() => openPractice(id as TopicId)} class="group rounded-2xl border border-[#b08b6e] bg-[#e8dcc7] p-5 text-left transition hover:-translate-y-1 hover:bg-[#eadfca]"><span class="font-mono text-xs text-[#7a674f]">{item.number}</span><h3 class="mt-2 font-bold">{item.title}</h3><p class="mt-2 text-sm leading-6">{item.summary}</p><span class="mt-4 inline-flex items-center gap-2 text-sm font-bold text-[#606c38]">Practise <Icon name="arrow" /></span></button>)}</div></section>
      </section>}

      {view === 'learn' && <section class="grid gap-7 lg:grid-cols-[250px_1fr]">
        <aside><p class="font-mono text-xs font-bold tracking-[.12em] uppercase">Learning path</p><div class="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">{Object.entries(topics).map(([id, item]) => <button type="button" onClick={() => setTopic(id as TopicId)} class={`rounded-2xl p-4 text-left ${topic === id ? 'bg-[#606c38] text-[#e8dcc7]' : 'bg-[#e8dcc7]'}`}><span class="font-mono text-xs opacity-70">{item.number}</span><span class="ml-3 text-sm font-bold">{item.title}</span></button>)}</div></aside>
        <article class="rounded-[2rem] bg-[#e8dcc7] p-7 sm:p-10"><p class="font-mono text-xs font-bold tracking-[.13em] text-[#6d7750] uppercase">{currentTopic.number} · lesson</p><h1 class="mt-3 text-4xl font-bold tracking-[-.05em]">{currentTopic.title}</h1><p class="mt-5 max-w-2xl text-lg leading-8">{currentTopic.summary}</p><div class="mt-8 grid gap-5 md:grid-cols-2"><div class="rounded-2xl bg-[#8b9d83] p-5"><p class="font-mono text-xs font-bold tracking-[.11em] uppercase">Useful formula</p><p class="mt-3 text-lg font-bold leading-7">{currentTopic.formula}</p></div><div class="rounded-2xl border border-[#b08b6e] p-5"><p class="font-mono text-xs font-bold tracking-[.11em] uppercase">Your first move</p><p class="mt-3 text-sm leading-7">{currentTopic.move}</p></div></div><div class="mt-5 rounded-2xl border-l-4 border-[#c66b3d] bg-[#d4b895] p-5"><p class="font-bold">Watch for this</p><p class="mt-2 text-sm leading-6">{currentTopic.trap}</p></div><section class="mt-8 rounded-[1.5rem] bg-[#c7d1bc] p-5 sm:p-6"><p class="font-mono text-xs font-bold tracking-[.12em] uppercase">Worked example · {lessonExample.label}</p><h2 class="mt-3 text-xl font-bold leading-7">{lessonExample.prompt}</h2><div class="mt-5 grid gap-5 lg:grid-cols-[.8fr_1.2fr]"><DataTable question={lessonExample} /><div><p class="font-bold">Follow the process</p><ol class="mt-3 grid gap-3">{lessonExample.steps.map((step, index) => <li class="flex gap-3 text-sm leading-6"><span class="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#b08b6e] font-mono text-xs font-bold">{index + 1}</span>{step}</li>)}</ol><p class="mt-5 rounded-xl bg-[#e8dcc7] px-4 py-3 text-sm font-bold">Answer: {lessonExample.answers[lessonExample.correct]}</p></div></div></section><div class="mt-8 border-t border-[#bfcaaf] pt-6"><p class="font-bold">The ADHD-friendly reset</p><ol class="mt-3 grid gap-2 text-sm leading-6"><li>1. Put your finger on what the question asks for.</li><li>2. Cover irrelevant columns or rows with paper.</li><li>3. Write the operation before starting the calculation.</li><li>4. Estimate: is your answer in the right ballpark?</li></ol></div><button type="button" onClick={() => openPractice(topic)} class="mt-8 inline-flex items-center gap-2 rounded-full bg-[#606c38] px-5 py-3 text-sm font-bold text-[#e8dcc7]">Practise {currentTopic.title.toLowerCase()} <Icon name="arrow" /></button></article>
      </section>}

      {view === 'practice' && <section class="rounded-[2rem] bg-[#e8dcc7] p-5 sm:p-8"><div class="flex flex-wrap items-center justify-between gap-4 border-b border-[#bdcbb5] pb-5"><div><p class="font-mono text-xs font-bold tracking-[.12em] uppercase">Guided practice · {topics[practiceQuestion.topic].title}</p><p class="mt-1 text-sm">Untimed in spirit; the clock is only there to make time visible.</p></div><div class="flex items-center gap-2 rounded-full bg-[#8b9d83] px-4 py-2 font-mono text-sm font-bold"><Icon name="timer" />{format(practiceSeconds)}</div></div><div class="mt-7 grid gap-7 lg:grid-cols-[.78fr_1.22fr]"><div><p class="mb-3 font-mono text-xs font-bold tracking-[.12em] uppercase">Information</p><DataTable question={practiceQuestion} /><p class="mt-4 text-sm leading-6">Use a scrap of paper. Reducing what you need to hold in your head is a valid test strategy.</p></div><div><p class="font-mono text-xs font-bold tracking-[.12em] uppercase">{practiceQuestion.label}</p><h1 class="mt-3 text-2xl font-bold leading-8 tracking-[-.035em]">{practiceQuestion.prompt}</h1><div class="mt-6 grid gap-3">{practiceQuestion.answers.map((item, index) => { const isCorrect = selected !== null && index === practiceQuestion.correct; const isWrong = selected === index && index !== practiceQuestion.correct; return <button type="button" disabled={selected !== null} onClick={() => answerPractice(index)} class={`flex items-center justify-between rounded-2xl border px-5 py-4 text-left text-sm font-bold transition ${isCorrect ? 'border-[#52724e] bg-[#b8cba9]' : isWrong ? 'border-[#c66b3d] bg-[#ead0bc]' : 'border-[#b8c7ad] hover:bg-[#dce3d2]'}`}><span>{item}</span><span class="font-mono text-xs">{String.fromCharCode(65 + index)}</span></button>; })}</div>{selected !== null && <div class={`mt-5 rounded-2xl p-5 ${selected === practiceQuestion.correct ? 'bg-[#b8cba9]' : 'bg-[#ead0bc]'}`}><p class="font-bold">{selected === practiceQuestion.correct ? 'Correct. Keep the method, not just the answer.' : 'Not this time. The worked method is the useful part.'}</p><p class="mt-2 text-sm leading-6">{practiceQuestion.trap}</p></div>}<div class="mt-5 flex flex-wrap gap-3"><button type="button" onClick={() => setShowMethod(!showMethod)} class="rounded-full border border-[#809175] px-4 py-2.5 text-sm font-bold">{showMethod ? 'Hide method' : 'Show the method'}</button>{selected !== null && <button type="button" onClick={nextPractice} class="inline-flex items-center gap-2 rounded-full bg-[#606c38] px-4 py-2.5 text-sm font-bold text-[#e8dcc7]">Next question <Icon name="arrow" /></button>}</div></div></div>{showMethod && <div class="mt-7 rounded-2xl bg-[#d4b895] p-5 sm:p-6"><p class="font-mono text-xs font-bold tracking-[.12em] uppercase">Work it out slowly</p><ol class="mt-4 grid gap-3">{practiceQuestion.steps.map((step, index) => <li class="flex gap-3 text-sm leading-6"><span class="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#b08b6e] font-mono text-xs font-bold">{index + 1}</span>{step}</li>)}</ol></div>}</section>}

      {view === 'mock' && <section class="rounded-[2rem] bg-[#e8dcc7] p-5 sm:p-8"><div class="flex flex-wrap items-center justify-between gap-4 border-b border-[#bdcbb5] pb-5"><div><p class="font-mono text-xs font-bold tracking-[.12em] uppercase">EPSO-style numerical mock</p><p class="mt-1 text-sm">10 questions · 20 minutes · choose an answer for every question.</p></div><div class={`flex items-center gap-2 rounded-full px-4 py-2 font-mono text-base font-bold ${mockLeft < 120 ? 'bg-[#ead0bc] text-[#7d402d]' : 'bg-[#8b9d83]'}`}><Icon name="timer" />{format(mockLeft)}</div></div>{!mockStarted ? <div class="mx-auto max-w-xl py-14 text-center"><h1 class="text-3xl font-bold tracking-[-.04em]">Ready for the full set?</h1><p class="mt-4 text-sm leading-7">You will see one question at a time. You can move between questions. Answers are only explained after you finish.</p><button type="button" onClick={() => setMockStarted(true)} class="mt-7 inline-flex items-center gap-2 rounded-full bg-[#606c38] px-5 py-3 text-sm font-bold text-[#e8dcc7]">Start 20-minute mock <Icon name="arrow" /></button></div> : <div class="mt-7 grid gap-7 lg:grid-cols-[.78fr_1.22fr]"><div><p class="mb-3 font-mono text-xs font-bold tracking-[.12em] uppercase">Question {mockIndex + 1} of {mockQuestions.length}</p><DataTable question={mockQuestion} /><div class="mt-5 flex flex-wrap gap-2">{mockQuestions.map((item, index) => <button type="button" onClick={() => setMockIndex(index)} class={`grid h-9 w-9 place-items-center rounded-full text-xs font-bold ${mockIndex === index ? 'bg-[#606c38] text-[#e8dcc7]' : mockAnswers[item.id] !== undefined ? 'bg-[#8b9d83]' : 'border border-[#9cad91]'}`}>{index + 1}</button>)}</div></div><div><h1 class="text-2xl font-bold leading-8 tracking-[-.035em]">{mockQuestion.prompt}</h1><div class="mt-6 grid gap-3">{mockQuestion.answers.map((answer, index) => <button type="button" onClick={() => setMockAnswers((items) => ({ ...items, [mockQuestion.id]: index }))} class={`flex items-center justify-between rounded-2xl border px-5 py-4 text-left text-sm font-bold ${mockAnswers[mockQuestion.id] === index ? 'border-[#606c38] bg-[#b8cba9]' : 'border-[#b8c7ad] hover:bg-[#dce3d2]'}`}><span>{answer}</span><span class="font-mono text-xs">{String.fromCharCode(65 + index)}</span></button>)}</div><div class="mt-7 flex flex-wrap justify-between gap-3"><button type="button" onClick={() => setMockIndex((value) => Math.max(0, value - 1))} disabled={mockIndex === 0} class="rounded-full border border-[#809175] px-4 py-2.5 text-sm font-bold disabled:opacity-40">Previous</button>{mockIndex < mockQuestions.length - 1 ? <button type="button" onClick={() => setMockIndex((value) => value + 1)} class="inline-flex items-center gap-2 rounded-full bg-[#606c38] px-4 py-2.5 text-sm font-bold text-[#e8dcc7]">Next <Icon name="arrow" /></button> : <button type="button" onClick={finishMock} class="rounded-full bg-[#c66b3d] px-4 py-2.5 text-sm font-bold text-[#fff5e9]">Finish mock</button>}</div><p class="mt-4 text-sm">{totalAnswered} of {mockQuestions.length} answered</p></div></div>}</section>}

      {view === 'review' && <section class="mx-auto max-w-4xl rounded-[2rem] bg-[#e8dcc7] p-7 sm:p-10"><p class="font-mono text-xs font-bold tracking-[.12em] uppercase">Mock complete</p><h1 class="mt-3 text-4xl font-bold tracking-[-.05em]">{mockScore} / {mockQuestions.length}</h1><p class="mt-4 max-w-xl text-base leading-7">{mockScore >= 8 ? 'Strong work. Review the misses once, then repeat on another day.' : mockScore >= 5 ? 'A good base. Use the missed questions to choose your next lesson.' : 'This score is a starting map, not a verdict. Return to one small skill and practise without pressure.'}</p><div class="mt-7 grid gap-4 sm:grid-cols-2"><div class="rounded-2xl bg-[#8b9d83] p-5"><p class="font-mono text-xs font-bold tracking-[.1em] uppercase">Answered</p><p class="mt-2 text-3xl font-bold">{totalAnswered} / {mockQuestions.length}</p></div><div class="rounded-2xl bg-[#d4b895] p-5"><p class="font-mono text-xs font-bold tracking-[.1em] uppercase">Time remaining</p><p class="mt-2 text-3xl font-bold">{format(mockLeft)}</p></div></div>{missed.length > 0 && <div class="mt-7"><h2 class="text-xl font-bold">Review these methods</h2><div class="mt-4 grid gap-3">{missed.map((id) => { const question = questions.find((item) => item.id === id)!; return <button type="button" onClick={() => { setPracticeIndex(questions.findIndex((item) => item.id === id)); setPracticeSeconds(0); setSelected(null); setShowMethod(true); setView('practice'); }} class="flex items-center justify-between rounded-2xl border border-[#b8c7ad] p-4 text-left hover:bg-[#dce3d2]"><span><b>{topics[question.topic].title}</b><span class="mt-1 block text-sm">{question.label}</span></span><Icon name="arrow" /></button>; })}</div></div>}<div class="mt-8 flex flex-wrap gap-3"><button type="button" onClick={() => openPractice()} class="rounded-full bg-[#606c38] px-5 py-3 text-sm font-bold text-[#e8dcc7]">Return to guided practice</button><button type="button" onClick={() => { resetMock(); setView('mock'); }} class="rounded-full border border-[#809175] px-5 py-3 text-sm font-bold">Reset mock</button></div></section>}

      {view === 'practiceDone' && <section class="mx-auto max-w-3xl rounded-[2rem] bg-[#e8dcc7] p-7 text-center sm:p-10"><p class="font-mono text-xs font-bold tracking-[.12em] uppercase">Three-example practice complete</p><h1 class="mt-3 text-4xl font-bold tracking-[-.05em]">{practiceScore} / {practiceQuestions.length}</h1><p class="mx-auto mt-4 max-w-lg text-sm leading-7">You have completed a short set. Review a lesson if anything felt unclear, then repeat a different skill or try the 10-question mock when ready.</p><div class="mt-8 flex flex-wrap justify-center gap-3"><button type="button" onClick={() => openPractice(topic)} class="rounded-full bg-[#606c38] px-5 py-3 text-sm font-bold text-[#e8dcc7]">Try another 3 examples</button><button type="button" onClick={() => setView('learn')} class="rounded-full border border-[#809175] px-5 py-3 text-sm font-bold">Return to lessons</button></div></section>}

      <footer class="mt-10 border-t border-[#9fac91] pt-5 text-sm leading-6"><p>Practice material created for familiarisation. EPSO’s own sample tests and your competition notice remain the source of truth for the selection procedure.</p><a class="mt-2 inline-block font-bold underline" href="https://eu-careers.europa.eu/en/numerical-reasoning" target="_blank" rel="noreferrer">Open the official EPSO numerical reasoning sample</a></footer>
    </main>
  </div>;
}
