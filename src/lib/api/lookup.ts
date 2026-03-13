import { api } from './axios-instance';
import { LookupCountry, LookupState, LookupCity, LookupCurrency, LookupPostalCode } from '@/types';

export const lookupApi = {
  getCountries: () =>
    api.get<LookupCountry[]>('/lookup/countries'),

  getStates: (countryId: number) =>
    api.get<LookupState[]>(`/lookup/states/${countryId}`),

  getCities: (stateId: number) =>
    api.get<LookupCity[]>(`/lookup/cities/${stateId}`),

  getPostalCodes: (cityId: number) =>
    api.get<LookupPostalCode[]>(`/lookup/postal-codes/${cityId}`),

  getCurrencies: () =>
    api.get<LookupCurrency[]>('/lookup/currencies'),
};
