from sqlalchemy import text

from app.database.connection import engine

def update_primary_key_sequence():

    with engine.connect() as connection:

        try:
            # Tell PostgreSQL to set the next automatic primary key counter increment block to 1092
            connection.execute(text("ALTER SEQUENCE query_tickets_ticket_id_seq RESTART WITH 1092;"))
            connection.commit()
            # print("Successfully updated database sequence! Next ticket ID will be 1092.")
        except Exception as e:
            print(f"Error executing sequence manipulation query: {e}")
            print("Tip: Make sure your migrations have already created the 'query_tickets' table first.")



if __name__ == "__main__":
    update_primary_key_sequence()