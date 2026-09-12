import {employeePayload, readEmployees} from '../src/screens/onboarding/screens/EmployeesScreen';
import {onboardingService} from '../src/services/apiService';

test('maps employee details without requesting admin permission assignment', () => {
  expect(employeePayload({phone: '+91 90000 00000', first: ' Ravi ', last: ' Kumar ', role: 'Employee', gender: 'Male', age: '25', experience: '2'})).toEqual({
    phone_number: '9000000000', name: 'Ravi Kumar', username: 'ravi', roles: 'employee', gender: 'male',
    age: 25, experience_years: 2, description: 'Saloon employee',
  });
});

test('keeps optional age empty and supports zero experience and owner/female selections', () => {
  const payload = employeePayload({phone: '9000000000', first: 'Priya', last: 'Shetty', role: 'Owner', gender: 'Female', age: '', experience: '0'});
  expect(payload).toMatchObject({roles: 'owner', gender: 'female', experience_years: 0});
  expect(payload).not.toHaveProperty('age');
  expect(payload).not.toHaveProperty('experience');
  expect(employeePayload({phone: '9000000000', first: 'Priya', last: 'Shetty', role: 'Employee', gender: 'Female'}).experience_years).toBe(0);
});

test('posts the mapped form as a top-level array to the selected salon', async () => {
  const originalFetch = global.fetch;
  global.fetch = jest.fn().mockResolvedValue({ok: true, headers: {get: () => 'application/json'}, json: async () => ({success: true})});
  try {
    await onboardingService.createEmployee('salon/1', employeePayload({phone: '9000000000', first: 'Ravi', last: 'Kumar', role: 'Employee', gender: 'Male', age: '25', experience: '2'}));
    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toBe('https://h6oc5ivg9a.execute-api.ap-south-1.amazonaws.com/dev/api/field/onboard/salon%2F1/employees');
    expect(options.method).toBe('POST');
    const body = JSON.parse(options.body);
    expect(body).toEqual([{phone_number: '9000000000', name: 'Ravi Kumar', username: 'ravi', roles: 'employee', gender: 'male', age: 25, experience_years: 2, description: 'Saloon employee'}]);
    expect(body[0]).not.toHaveProperty('permissions');
  } finally {
    global.fetch = originalFetch;
  }
});

test('reads admin-style employee names and roles after saving', () => {
  expect(readEmployees([{id: 'member-1', name: 'Ravi Kumar', roles: 'employee', phone_number: '9000000000', gender: 'male'}])[0]).toMatchObject({id: 'member-1', first: 'Ravi', last: 'Kumar', role: 'employee'});
});
