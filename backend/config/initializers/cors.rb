# Be sure to restart your server when you modify this file.

allowed_origins = ENV.fetch("TVT_ALLOWED_ORIGINS", "").split(",").map(&:strip).reject(&:empty?)

if allowed_origins.empty? && Rails.env.development?
  allowed_origins = [
    %r{\Ahttp://localhost:\d+\z},
    %r{\Ahttp://127\.0\.0\.1:\d+\z},
  ]
end

if allowed_origins.any?
  Rails.application.config.middleware.insert_before 0, Rack::Cors do
    allow do
      origins(*allowed_origins)

      resource "/api/*",
        headers: :any,
        methods: %i[get options head]
    end
  end
end
