import api from './api';
import {ApiResponse, RentalOffer, RentalDemand, CargoDemand, PageData} from '../types';

export const demandService = {
  // === Rental Offers (供给) ===
  listOffers: (params?: {page?: number; page_size?: number; service_type?: string}) =>
    api.get<any, ApiResponse<PageData<RentalOffer>>>('/rental/offer', {params}),

  createOffer: (data: Partial<RentalOffer>) =>
    api.post<any, ApiResponse<RentalOffer>>('/rental/offer', data),

  getOffer: (id: number) =>
    api.get<any, ApiResponse<RentalOffer>>(`/rental/offer/${id}`),

  myOffers: (params?: {page?: number; page_size?: number}) =>
    api.get<any, ApiResponse<PageData<RentalOffer>>>('/rental/offer/my', {params}),

  updateOffer: (id: number, data: Partial<RentalOffer>) =>
    api.put<any, ApiResponse>(`/rental/offer/${id}`, data),

  deleteOffer: (id: number) =>
    api.delete<any, ApiResponse>(`/rental/offer/${id}`),

  // === Rental Demands (需求) ===
  listDemands: (params?: {page?: number; page_size?: number; demand_type?: string}) =>
    api.get<any, ApiResponse<PageData<RentalDemand>>>('/rental/demand', {params}),

  createDemand: (data: Partial<RentalDemand>) =>
    api.post<any, ApiResponse<RentalDemand>>('/rental/demand', data),

  getDemand: (id: number) =>
    api.get<any, ApiResponse<RentalDemand>>(`/rental/demand/${id}`),

  myDemands: (params?: {page?: number; page_size?: number}) =>
    api.get<any, ApiResponse<PageData<RentalDemand>>>('/rental/demand/my', {params}),

  updateDemand: (id: number, data: Partial<RentalDemand>) =>
    api.put<any, ApiResponse>(`/rental/demand/${id}`, data),

  deleteDemand: (id: number) =>
    api.delete<any, ApiResponse>(`/rental/demand/${id}`),

  getDemandMatches: (id: number) =>
    api.get<any, ApiResponse>(`/rental/demand/${id}/matches`),

  // === Cargo Demands (货运) ===
  listCargos: (params?: {page?: number; page_size?: number; cargo_type?: string}) =>
    api.get<any, ApiResponse<PageData<CargoDemand>>>('/cargo', {params}),

  createCargo: (data: Partial<CargoDemand>) =>
    api.post<any, ApiResponse<CargoDemand>>('/cargo', data),

  getCargo: (id: number) =>
    api.get<any, ApiResponse<CargoDemand>>(`/cargo/${id}`),

  myCargos: (params?: {page?: number; page_size?: number}) =>
    api.get<any, ApiResponse<PageData<CargoDemand>>>('/cargo/my', {params}),

  updateCargo: (id: number, data: Partial<CargoDemand>) =>
    api.put<any, ApiResponse>(`/cargo/${id}`, data),

  deleteCargo: (id: number) =>
    api.delete<any, ApiResponse>(`/cargo/${id}`),

  getCargoMatches: (id: number) =>
    api.get<any, ApiResponse>(`/cargo/${id}/matches`),
};
