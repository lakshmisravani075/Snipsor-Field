# Onboarding timeline integration status

The existing client now provides `leadService.getOnboardingTimeline(leadId)`.
It uses the deployed base URL, auth token, timeout and error handling already in
`src/services/apiService.js`. It returns the response without guessing step fields.

No timeline schema, backend type, or response example was found in the project.
Continue actions in `OnboardingTasksScreen` now call the method with the selected
task's `leadId`, wait for success, and pass the untouched response as
`onboardingTimeline` to the existing onboarding screen. Duplicate requests and
stale navigation results are prevented; failures leave the current screen open.
New/Start still navigates directly without fetching a timeline.

Until the response contract is confirmed, step selection continues to use the
existing resume logic. The timeline is fetched but is not interpreted as progress.

## Required backend contract

Provide an actual successful response for an in-progress lead, including:

- The response wrapper and ordered step collection, if present.
- Stable step identifiers and their meaning.
- Exact current, completed and pending values or flags.
- The representation of a fully completed onboarding and an empty timeline.
- Whether a pending step requires completed data from earlier steps to resume.

These describe needed information, not proposed backend field names.

## Existing navigation points

`OnboardingTasksScreen` owns navigation from task cards, salon cards, and task
details to `SalonOnboardingScreen`. Normalized tasks already contain `id` and
`leadId`, derived from the selected API lead. Continue should pass `task.leadId`
to the method; no lead ID should be hardcoded. New/Start should keep its current
direct navigation and not request the timeline.

The existing eight UI steps are Basic Details, Files & Media, Address, Services,
Employees, Salon Availability, Employee Availability, and KYC. Backend step IDs
must be mapped to these only after their actual values are known.

`SalonOnboardingScreen` currently prioritizes local saved progress and the
KYC Pending status over `salon.onboardingStep`. Merely passing a step number
will not guarantee server-authoritative resume. A narrowly scoped initialization
change will be needed to honor confirmed API progress without losing entered
form data. No such change has been made before confirming the contract.

The Tasks card shows a temporary loading label during the request. Card styles,
other screens and Start behavior are unchanged.
