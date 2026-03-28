Rails.application.routes.draw do
  namespace :api do
    namespace :v1 do
      get "point_tiles/manifest", to: "point_tiles#manifest"
      get "years/:year/point_tiles/:mode/:z/:x/:y", to: "point_tiles#show"
      get "years/:year/entries/:id/top_birds", to: "entries#top_birds"
    end
  end

  get "up" => "rails/health#show", as: :rails_health_check
end
