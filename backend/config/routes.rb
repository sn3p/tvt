Rails.application.routes.draw do
  namespace :api do
    namespace :v1 do
      get "status", to: "status#show"
      get "point_tiles/manifest", to: "point_tiles#manifest"
      get "years/:year/point_stats", to: "point_stats#show"
      get "years/:year/pc4_bounds/:pc4", to: "pc4_bounds#show"
      get "years/:year/point_tiles/:mode/:z/:x/:y", to: "point_tiles#show"
      get "years/:year/entries/:id/top_birds", to: "entries#top_birds"
      get "species_catalog", to: "area_species#catalog"
      get "species_grid", to: "area_species#grid"
      get "areas/:area/species_manifest", to: "area_species#manifest"
      get "areas/:area/species_catalog", to: "area_species#catalog"
      get "areas/:area/species_grid", to: "area_species#grid"
    end
  end

  get "up" => "rails/health#show", as: :rails_health_check
end
