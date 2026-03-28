require "test_helper"

class ApiV1BackendTest < ActionDispatch::IntegrationTest
  setup do
    EntryTileMembership.delete_all
    EntryBirdCount.delete_all
    Bird.delete_all
    Entry.delete_all
  end

  test "manifest exposes years and published modes" do
    Entry.create!(
      year: 2025,
      external_id: 1001,
      pc4: "9721",
      lat: 53.2194,
      lng: 6.5665,
      is_org: false,
    )
    Entry.create!(
      year: 2026,
      external_id: 1002,
      pc4: "1011",
      lat: 52.3676,
      lng: 4.9041,
      is_org: true,
    )

    get "/api/v1/point_tiles/manifest"

    assert_response :success
    body = JSON.parse(response.body)
    assert_equal 1, body["contract_version"]
    assert_equal [2025, 2026], body["years_available"]
    assert_equal %w[private isorg], body["modes_available"]
    assert_equal "private", body.dig("defaults", "mode")
    assert_equal 6, body.dig("defaults", "zoom_min")
    assert_equal 13, body.dig("defaults", "zoom_max")
  end

  test "point tile returns expected points for a populated tile" do
    entry = Entry.create!(
      year: 2025,
      external_id: 463_535,
      pc4: "1011",
      lat: 52.3662666,
      lng: 4.9025050,
      is_org: false,
    )
    EntryTileMembership.create!(
      entry: entry,
      year: 2025,
      mode: "private",
      z: 6,
      x: 32,
      y: 21,
    )

    get "/api/v1/years/2025/point_tiles/private/6/32/21"

    assert_response :success
    body = JSON.parse(response.body)
    assert_equal 2025, body["year"]
    assert_equal "private", body["mode"]
    assert_equal 6, body["z"]
    assert_equal 32, body["x"]
    assert_equal 21, body["y"]
    assert_equal 1, body["points"].length
    assert_equal 463_535, body["points"][0]["id"]
    assert_equal "1011", body["points"][0]["pc4"]
  end

  test "point tile rejects unsupported modes" do
    get "/api/v1/years/2025/point_tiles/type1/6/32/21"

    assert_response :unprocessable_entity
    body = JSON.parse(response.body)
    assert_match(/unsupported mode/, body["error"])
  end

  test "point tile rejects out of range coordinates" do
    get "/api/v1/years/2025/point_tiles/private/15/32/21"

    assert_response :unprocessable_entity
    body = JSON.parse(response.body)
    assert_equal "invalid tile parameters", body["error"]
  end

  test "point tile returns an empty points array for a tile with no memberships" do
    get "/api/v1/years/2025/point_tiles/isorg/9/0/0"

    assert_response :success
    body = JSON.parse(response.body)
    assert_equal [], body["points"]
  end

  test "top birds returns not found for an unknown entry" do
    get "/api/v1/years/2025/entries/999999/top_birds"

    assert_response :not_found
    body = JSON.parse(response.body)
    assert_equal "entry not found", body["error"]
  end

  test "top birds rejects invalid parameters" do
    get "/api/v1/years/not-a-year/entries/abc/top_birds"

    assert_response :unprocessable_entity
    body = JSON.parse(response.body)
    assert_equal "invalid entry parameters", body["error"]
  end

  test "top birds returns normalized ordered birds for an entry" do
    entry = Entry.create!(
      year: 2025,
      external_id: 463_535,
      pc4: "1011",
      lat: 52.3662666,
      lng: 4.9025050,
      is_org: false,
    )
    bird_a = Bird.create!(external_id: 79, name: "Zwarte kraai")
    bird_b = Bird.create!(external_id: 9, name: "Ekster")
    EntryBirdCount.create!(entry: entry, bird: bird_a, rank: 2, count: 2, bird_name_cache: "Zwarte kraai")
    EntryBirdCount.create!(entry: entry, bird: bird_b, rank: 1, count: 3, bird_name_cache: "Ekster")

    get "/api/v1/years/2025/entries/463535/top_birds"

    assert_response :success
    body = JSON.parse(response.body)
    assert_equal 463_535, body["entry_id"]
    assert_equal 2025, body["year"]
    assert_equal 2, body["birds"].length
    assert_equal 9, body["birds"][0]["bird_id"]
    assert_equal "Ekster", body["birds"][0]["name"]
    assert_equal 3, body["birds"][0]["count"]
    assert_equal 1, body["birds"][0]["rank"]
    assert_equal 79, body["birds"][1]["bird_id"]
  end
end
