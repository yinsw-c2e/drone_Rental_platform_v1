import {apiV2} from './api';
import {ApiResponse, RentalOffer, RentalDemand, CargoDemand, PageData} from '../types';

export const demandService = {
  // === Rental Offers (供给) ===
  listOffers: (params?: {page?: number; page_size?: number; service_type?: string}) =>
    apiV2.get<any, ApiResponse<PageData<RentalOffer>>>('/rental/offer', {params}),

  createOffer: (data: Partial<RentalOffer>) =>
    apiV2.post<any, ApiResponse<RentalOffer>>('/rental/offer', data),

  getOffer: (id: number) =>
    apiV2.get<any, ApiResponse<RentalOffer>>(`/rental/offer/${id}`),

  myOffers: (params?: {page?: number; page_size?: number}) =>
    apiV2.get<any, ApiResponse<PageData<RentalOffer>>>('/rental/offer/my', {params}),

  updateOffer: (id: number, data: Partial<RentalOffer>) =>
    apiV2.put<any, ApiResponse>(`/rental/offer/${id}`, data),

  deleteOffer: (id: number) =>
    apiV2.delete<any, ApiResponse>(`/rental/offer/${id}`),

  // === Rental Demands (需求) ===
  listDemands: (params?: {page?: number; page_size?: number; demand_type?: string}) =>
    apiV2.get<any, ApiResponse<PageData<RentalDemand>>>('/rental/demand', {params}),

  createDemand: (data: Partial<RentalDemand>) =>
    apiV2.post<any, ApiResponse<RentalDemand>>('/rental/demand', data),

  getDemand: (id: number) =>
    apiV2.get<any, ApiResponse<RentalDemand>>(`/rental/demand/${id}`),

  myDemands: (params?: {page?: number; page_size?: number}) =>
    apiV2.get<any, ApiResponse<PageData<RentalDemand>>>('/rental/demand/my', {params}),

  updateDemand: (id: number, data: Partial<RentalDemand>) =>
    apiV2.put<any, ApiResponse>(`/rental/demand/${id}`, data),

  deleteDemand: (id: number) =>
    apiV2.delete<any, ApiResponse>(`/rental/demand/${id}`),

  getDemandMatches: (id: number) =>
    apiV2.get<any, ApiResponse>(`/rental/demand/${id}/matches`),

  // === Cargo Demands (货运) ===
  listCargos: (params?: {page?: number; page_size?: number; cargo_type?: string}) =>
    apiV2.get<any, ApiResponse<PageData<CargoDemand>>>('/cargo', {params}),

  createCargo: (data: Partial<CargoDemand>) =>
    apiV2.post<any, ApiResponse<CargoDemand>>('/cargo', data),

  getCargo: (id: number) =>
    apiV2.get<any, ApiResponse<CargoDemand>>(`/cargo/${id}`),

  myCargos: (params?: {page?: number; page_size?: number}) =>
    apiV2.get<any, ApiResponse<PageData<CargoDemand>>>('/cargo/my', {params}),

  updateCargo: (id: number, data: Partial<CargoDemand>) =>
    apiV2.put<any, ApiResponse>(`/cargo/${id}`, data),

  deleteCargo: (id: number) =>
    apiV2.delete<any, ApiResponse>(`/cargo/${id}`),

  getCargoMatches: (id: number) =>
    apiV2.get<any, ApiResponse>(`/cargo/${id}/matches`),
};
