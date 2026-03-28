namespace :tvt do
  desc "Import one harvested TVT year into the backend database"
  task :import_year, [:year] => :environment do |_task, args|
    year = Integer(args[:year] || ENV.fetch("YEAR"))
    Imports::YearImporter.new.import_year(year)
  end

  desc "Rebuild tile memberships for one imported TVT year"
  task :rebuild_tiles, [:year] => :environment do |_task, args|
    year = Integer(args[:year] || ENV.fetch("YEAR"))
    Imports::EntryTileMembershipBuilder.new.rebuild_year(year)
  end
end
