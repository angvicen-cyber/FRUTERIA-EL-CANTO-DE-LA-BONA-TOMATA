# Security Specification - Frutería el Cantó

## Data Invariants
1. A TimeLog must always be associated with a valid User ID.
2. Only Ana (admin) can view everyone's records. Employees can only view their own.
3. Timestamps/Dates must be string Format YYYY-MM-DD.
4. Entry/Exit times must be strings (e.g. "07:30").

## The Dirty Dozen Payloads
1. **Malicious ID injection**: Attempting to use a 1MB string as a log ID.
2. **Identity Spoofing**: Employee A trying to create a log for Employee B.
3. **Admin Privilege Escalation**: Employee trying to set their role to 'admin'.
4. **Shadow Field injection**: Adding `isVerified: true` to a TimeLog.
5. **PII Leak**: Non-admin user attempting to list all users.
6. **Time Tampering**: Updating another user's totalHours.
7. **Invalid Format**: Sending totalHours as a string.
8. **Orphaned Record**: Creating a log with a non-existent userId (logical check, rules ensure identity matches auth).
9. **Total Access**: Attempting to read `timeLogs` without being signed in.
10. **State Lockdown Bypass**: Trying to change the `userId` of an existing log.
11. **Negative Hours**: Sending `totalHours: -5`.
12. **Future Date Injection**: (Handled by app logic, rules check type/size).

## Test Strategy
I will use the Firebase Emulator for testing in my head (as a reasoning agent) and generate the test file.
For now, I'll proceed with creating the application code.
