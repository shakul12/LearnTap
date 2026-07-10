-- Detailed review categories: alongside the overall star rating, students
-- rate subject expertise, professionalism, and communication (all optional).

alter table reviews
  add column expertise_rating int check (expertise_rating between 1 and 5),
  add column professionalism_rating int check (professionalism_rating between 1 and 5),
  add column communication_rating int check (communication_rating between 1 and 5);
